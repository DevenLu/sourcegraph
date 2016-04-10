import "babel-polyfill";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {RouterContext, match, createMemoryHistory} from "react-router";
import {rootRoute} from "sourcegraph/app/App";
import dumpStores from "sourcegraph/init/dumpStores";
import resetStores from "sourcegraph/init/resetStores";
import {trackedPromisesCount, allTrackedPromisesResolved} from "sourcegraph/app/status";
import * as context from "sourcegraph/app/context";
import split from "split";
import {httpStatusCode} from "sourcegraph/app/status";

/*
TODO: We can optimize this iterative rendering scheme to avoid wasted effort
in actual rendering when we know we don't have sufficient data to be finished.
We need to do something like throwing an error when any fetch is called, and
catching that error in the call below to renderToString.

This would mean that we'd have more render iterations (since each new iteration
would only trigger at most 1 additional async fetch), but they would be cheaper
since they would not do any actual rendering, only component initialization.
*/

// renderIter iteratively renders the HTML so that fetches are triggered. Do this
// until we reach the fixed point where no additional fetches are triggered.
function renderIter(i, props, location, deadline, callback) {
	if (i > 10) {
		throw new Error(`Maximum React server-side rendering iterations reached (${i}).`);
	}

	let t0 = Date.now();

	// Trigger a render so that we start the async data fetches.
	let htmlStr = ReactDOMServer.renderToString(<RouterContext {...props} />);
	console.log(`RENDER#${i}: renderToString took ${Date.now() - t0} msec`);

	const nearDeadline = (deadline - Date.now()) < 200;
	if (trackedPromisesCount() === 0 || nearDeadline) {
		if (i > 1) {
			console.warn(`PERF NOTE: Rendering path ${props.location.pathname} took ${i} iterations (of renderToString and server RTTs) due to new async fetches being triggered after each iteration (likely as more data became available). Pipeline data better to improve performance.`);
		}

		// 202 Accepted to indicate processing isn't complete.
		const incomplete = trackedPromisesCount() > 0;
		let code = location.state ? httpStatusCode(location.state.error) : 202;
		if (incomplete && code === 200) code = 202;

		// No additional async fetches were triggered, so we are done!
		callback({
			statusCode: code,
			body: htmlStr,
			contentType: "text/html; charset=utf-8",
			stores: dumpStores(),
			incomplete: incomplete,
		});
		return;
	}

	let tFetch0 = Date.now();
	const promisesCount = trackedPromisesCount();
	allTrackedPromisesResolved().then(() => {
		console.log(`RENDER#${i}: ${promisesCount} fetches took ${Date.now() - tFetch0} msec`);
		renderIter(i + 1, props, location, deadline, callback);
	}).catch((e) => callback({
		statusCode: 500,
		error: `Unhandled error not caught by ReactDOMServer.renderToString:\n${e.stack}`,
	}));
}

// handle is called from Go to render the page's contents.
const handle = (arg, callback) => {
	context.reset(arg.jsContext);
	resetStores();

	// Track the current location.
	let hist = createMemoryHistory(arg.location);
	let location = {};
	hist.listen((loc) => {
		Object.assign(location, loc);
	});

	match({history: hist, location: arg.location, routes: rootRoute}, (err, redirectLocation, renderProps) => {
		if (typeof err === "undefined" && typeof redirectLocation === "undefined" && typeof renderProps === "undefined") {
			callback({
				statusCode: 404,
				contentType: "text/plain",
				error: "no route",
			});
			return;
		}
		if (err) {
			callback({
				statusCode: 500,
				error: `Routing error: ${err}`,
			});
			return;
		}
		if (redirectLocation) {
			// Assumes that all redirects are 301s (Moved Permanently).
			callback({
				statusCode: 301,
				redirectLocation,
				contentType: "text/html",
				body: "Redirecting...",
			});
			return;
		}

		const props = {...renderProps, ...arg.extraProps};

		renderIter(1, props, location, arg.deadline, callback);
	});
};

// jsserver: listens on stdin for lines of JSON sent by the app/internal/ui Go package.
if (typeof global !== "undefined" && global.process && global.process.env.JSSERVER) {
	global.process.stdout.write("\"ready\"\n");
	console.log = console.error;

	process.stdin.pipe(split())
		.on("data", (line) => {
			if (line === "") return;
			handle(JSON.parse(line), (data) => {
				global.process.stdout.write(JSON.stringify(data));
				global.process.stdout.write("\n");
			});
		})
		.on("error", (err) => {
			console.error("jsserver: error reading line from stdin:", err);
		});
}
