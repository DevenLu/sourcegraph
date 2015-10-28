import React from "react";

export default class Component extends React.Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	componentWillMount() {
		this._doUpdateState(Object.assign({}, this.state), this.props);
	}

	componentWillReceiveProps(nextProps) {
		this._doUpdateState(Object.assign({}, this.state), nextProps);
	}

	shouldComponentUpdate(nextProps, nextState) {
		let keys = Object.keys(nextState);
		if (Object.keys(this.state).length !== keys.length) {
			return true;
		}
		for (let i = 0; i < keys.length; i++) {
			let k = keys[i];
			if (nextState[k] !== this.state[k]) {
				return true;
			}
		}
		return false;
	}

	patchState(patch) {
		this._doUpdateState(Object.assign({}, this.state, patch), this.props);
	}

	_doUpdateState(newState, props) {
		this.updateState(newState, props);
		if (this.requestData) {
			let prevState = Object.assign({}, this.state);
			setTimeout(() => {
				this.requestData(prevState, newState);
			}, 0);
		}
		this.setState(newState);
	}

	updateState(state, props) {
		// override
	}
}
