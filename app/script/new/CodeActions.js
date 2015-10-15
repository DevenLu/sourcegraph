export class WantFile {
	constructor(repo, rev, tree) {
		this.repo = repo;
		this.rev = rev;
		this.tree = tree;
	}
}

export class FileFetched {
	constructor(repo, rev, tree, file) {
		this.repo = repo;
		this.rev = rev;
		this.tree = tree;
		this.file = file;
	}
}

export class SelectDef {
	constructor(def) {
		this.def = def;
	}
}

export class HighlightDef {
	constructor(def) {
		this.def = def;
	}
}
