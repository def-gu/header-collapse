/**
 * Header Controls Collapse
 *
 * pf2e actor/item sheets are built on ApplicationV1. Their header (.window-header)
 * holds a horizontal row of <a class="header-button …"> buttons: one per module,
 * plus the stock close cross <a class="header-button … close">. With many modules
 * the row overflows the title bar and pushes the close button past the window edge.
 *
 * On every sheet render this module moves all header buttons EXCEPT the close one
 * into a drop-down menu behind a hamburger (≡) toggle. Moving a DOM node keeps the
 * click handlers attached to it, so the buttons keep working as before.
 */

const MODULE_ID = "header-collapse";
const TOGGLE_CLASS = `${MODULE_ID}-toggle`;
const MENU_CLASS = `${MODULE_ID}-menu`;

// One MutationObserver per open sheet, to catch buttons that modules draw in
// asynchronously after the first render. Keyed by app.appId.
const observers = new Map();

Hooks.once("init", () => {
	game.settings.register(MODULE_ID, "minButtons", {
		name: "HEADERCOLLAPSE.MinButtonsName",
		hint: "HEADERCOLLAPSE.MinButtonsHint",
		scope: "client",
		config: true,
		type: Number,
		default: 1
	});
});

// renderActorSheet / renderItemSheet fire for ALL sheets of the matching kind,
// because v1 calls the render hook for the whole class inheritance chain.
for (const hook of ["renderActorSheet", "renderItemSheet"]) {
	Hooks.on(hook, onRenderSheet);
}

// Drop the observer when the sheet closes.
Hooks.on("closeApplication", (app) => {
	const obs = observers.get(app.appId);
	if (obs) {
		obs.disconnect();
		observers.delete(app.appId);
	}
});

/**
 * @param {Application} app
 * @param {JQuery|HTMLElement} html  In appv1 the hook passes jQuery; unwrap the DOM node.
 */
function onRenderSheet(app, html) {
	const root = html?.[0] ?? html;
	if (!(root instanceof HTMLElement)) return;
	// requestAnimationFrame lets other render hooks in the same cycle draw their
	// buttons before we collect them.
	requestAnimationFrame(() => {
		collapseHeader(app, root);
		attachObserver(app, root);
	});
}

/**
 * Moves every header button except the close one into the drop-down menu.
 * Idempotent: repeated calls reuse the already created menu and toggle and
 * only pick up new buttons.
 */
function collapseHeader(app, root) {
	const header = root.querySelector(":scope > .window-header");
	if (!header) return;

	const close = header.querySelector(".header-button.close");
	const movable = [...header.querySelectorAll(".header-button")].filter((b) => b !== close);

	let menu = root.querySelector(`:scope > .${MENU_CLASS}`);
	if (movable.length === 0) return; // nothing to collapse
	if (movable.length < game.settings.get(MODULE_ID, "minButtons") && !menu) return;

	// The menu is created once, as a child of the window (.window-app): the stock v1
	// click binding (html.find(".header-button")) then still sees our buttons.
	if (!menu) {
		menu = document.createElement("nav");
		menu.className = MENU_CLASS;
		menu.hidden = true;
		root.appendChild(menu);
	}

	// The toggle is created once, right before the close button. It must NOT get the
	// header-button class, or the stock v1 click handling would bind to it.
	let toggle = header.querySelector(`.${TOGGLE_CLASS}`);
	if (!toggle) {
		toggle = document.createElement("a");
		toggle.className = `control ${TOGGLE_CLASS}`;
		toggle.dataset.tooltip = "HEADERCOLLAPSE.Menu";
		toggle.setAttribute("aria-label", game.i18n.localize("HEADERCOLLAPSE.Menu"));
		toggle.innerHTML = `<i class="fa-solid fa-bars"></i>`;
		toggle.addEventListener("click", (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			if (menu.hidden) openMenu(toggle, menu);
			else closeMenu(menu);
		});
		if (close) header.insertBefore(toggle, close);
		else header.appendChild(toggle);
	}

	// Move the buttons into the menu. appendChild relocates a node with its handlers.
	for (const b of movable) menu.appendChild(b);
}

function openMenu(toggle, menu) {
	menu.hidden = false;

	// The menu is a child of the window (.window-app). Position it ABSOLUTELY relative
	// to the window, not the viewport: dragging moves the window via transform, and a
	// transform on an ancestor turns position:fixed into positioning relative to that
	// ancestor — hence the old "drifts right"/"never shows up" bugs. With
	// position:absolute the menu is anchored to the window itself. Coordinates are the
	// DIFFERENCE of two getBoundingClientRect calls (toggle and window): the transform
	// offset cancels out in the difference, so the position is exact during any drag.
	const root = menu.closest(".window-app, .application") ?? menu.parentElement;
	const tr = toggle.getBoundingClientRect();
	const rr = root.getBoundingClientRect();
	menu.style.position = "absolute";
	menu.style.top = `${tr.bottom - rr.top + 2}px`; // right below the toggle
	menu.style.right = `${Math.max(0, rr.right - tr.right)}px`; // right edge under the toggle
	menu.style.left = "auto";
	menu.style.maxHeight = `${Math.max(120, rr.bottom - tr.bottom - 12)}px`; // stay above the window bottom

	// Close when clicking outside the menu.
	menu._onDoc = (ev) => {
		if (!menu.contains(ev.target) && !toggle.contains(ev.target)) closeMenu(menu);
	};
	// Picking an item also closes the menu.
	menu._onPick = (ev) => {
		if (ev.target.closest(".header-button")) closeMenu(menu);
	};
	menu.addEventListener("click", menu._onPick);
	setTimeout(() => document.addEventListener("click", menu._onDoc), 0);
}

function closeMenu(menu) {
	menu.hidden = true;
	if (menu._onDoc) document.removeEventListener("click", menu._onDoc);
	if (menu._onPick) menu.removeEventListener("click", menu._onPick);
}

/**
 * Watches the header: if a module adds a button later (asynchronously), we pick it
 * up too. The observer is disconnected during our own move to avoid a feedback loop.
 */
function attachObserver(app, root) {
	if (observers.has(app.appId)) return;
	const header = root.querySelector(":scope > .window-header");
	if (!header) return;

	const obs = new MutationObserver(() => {
		obs.disconnect();
		collapseHeader(app, root);
		obs.observe(header, { childList: true });
	});
	obs.observe(header, { childList: true });
	observers.set(app.appId, obs);
}
