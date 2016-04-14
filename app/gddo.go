package app

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"sourcegraph.com/sourcegraph/sourcegraph/app/internal"
	"sourcegraph.com/sourcegraph/sourcegraph/app/router"
	"sourcegraph.com/sourcegraph/sourcegraph/conf/feature"
	"sourcegraph.com/sourcegraph/sourcegraph/util/errcode"
)

func init() {
	if feature.Features.GodocRefs {
		internal.Handlers[router.GDDORefs] = serveGDDORefs
	}
}

// isGoRepoPath returns whether pkg is (likely to be) a Go stdlib
// package import path.
func isGoRepoPath(pkg string) bool {
	// If no path components have a ".", then guess that it's a Go
	// stdlib package.
	parts := strings.Split(pkg, "/")
	for _, p := range parts {
		if strings.Contains(p, ".") {
			return false
		}
	}
	return true
}

// serveGDDORefs handles requests referred from godoc.org refs links.
func serveGDDORefs(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	repo := q.Get("repo")
	pkg := q.Get("pkg")
	def := q.Get("def")

	if repo == "" && isGoRepoPath(pkg) {
		repo = "github.com/golang/go"
	}

	if repo == "" || pkg == "" || def == "" {
		return &errcode.HTTPErr{Status: http.StatusBadRequest, Err: errors.New("repo, pkg, and def must be specified in query string")}
	}

	// TODO(sqs): redirect to refs page when it's nicer looking.
	http.Redirect(w, r, fmt.Sprintf("/%s/-/def/GoPackage/%s/-/%s", repo, pkg, def), http.StatusMovedPermanently)
	return nil
}
