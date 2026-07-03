/**
 * Header Controls Collapse
 *
 * Лист актёра/предмета в pf2e построен на ApplicationV1. Его шапка (.window-header)
 * содержит горизонтальный ряд кнопок <a class="header-button …">: по одной на каждый
 * модуль, плюс штатный крестик <a class="header-button … close">. Когда модулей много,
 * ряд переполняет заголовок и выдавливает крестик за край окна.
 *
 * Этот модуль на каждом рендере листа перекладывает все кнопки шапки, КРОМЕ крестика,
 * в выпадающее меню под кнопкой-гамбургером (≡). Перенос DOM-узла сохраняет навешанные
 * на него обработчики кликов, поэтому кнопки продолжают работать как раньше.
 */

const MODULE_ID = "header-collapse";
const TOGGLE_CLASS = `${MODULE_ID}-toggle`;
const MENU_CLASS = `${MODULE_ID}-menu`;

// Один MutationObserver на открытый лист — чтобы ловить кнопки, которые модули
// дорисовывают асинхронно, уже после первого рендера. Ключ — app.appId.
const observers = new Map();

Hooks.once("init", () => {
	game.settings.register(MODULE_ID, "minButtons", {
		name: "Минимум кнопок для сворачивания",
		hint: "Прятать кнопки шапки в меню ≡, только если их (не считая крестика) не меньше этого числа.",
		scope: "client",
		config: true,
		type: Number,
		default: 1
	});
});

// renderActorSheet / renderItemSheet срабатывают для ВСЕХ листов соответствующего
// типа, потому что v1 вызывает render-хук по всей цепочке наследования классов.
for (const hook of ["renderActorSheet", "renderItemSheet"]) {
	Hooks.on(hook, onRenderSheet);
}

// Чистим observer, когда лист закрывается.
Hooks.on("closeApplication", (app) => {
	const obs = observers.get(app.appId);
	if (obs) {
		obs.disconnect();
		observers.delete(app.appId);
	}
});

/**
 * @param {Application} app
 * @param {JQuery|HTMLElement} html  В appv1 хук передаёт jQuery; берём из него DOM-узел.
 */
function onRenderSheet(app, html) {
	const root = html?.[0] ?? html;
	if (!(root instanceof HTMLElement)) return;
	// requestAnimationFrame даёт другим render-хукам в этом же цикле дорисовать свои
	// кнопки, прежде чем мы их соберём.
	requestAnimationFrame(() => {
		collapseHeader(app, root);
		attachObserver(app, root);
	});
}

/**
 * Перекладывает все кнопки шапки, кроме крестика, в выпадающее меню.
 * Идемпотентна: при повторном вызове переиспользует уже созданные меню и гамбургер,
 * подбирая только новые кнопки.
 */
function collapseHeader(app, root) {
	const header = root.querySelector(":scope > .window-header");
	if (!header) return;

	const close = header.querySelector(".header-button.close");
	const movable = [...header.querySelectorAll(".header-button")].filter((b) => b !== close);

	let menu = root.querySelector(`:scope > .${MENU_CLASS}`);
	if (movable.length === 0) return; // нечего сворачивать
	if (movable.length < game.settings.get(MODULE_ID, "minButtons") && !menu) return;

	// Меню создаём один раз и делаем потомком окна (.window-app): тогда штатная
	// привязка кликов v1 (html.find(".header-button")) по-прежнему видит наши кнопки.
	if (!menu) {
		menu = document.createElement("nav");
		menu.className = MENU_CLASS;
		menu.hidden = true;
		root.appendChild(menu);
	}

	// Гамбургер создаём один раз и ставим прямо перед крестиком. НЕ даём ему класс
	// header-button, чтобы на него не навесилась штатная обработка кликов v1.
	let toggle = header.querySelector(`.${TOGGLE_CLASS}`);
	if (!toggle) {
		toggle = document.createElement("a");
		toggle.className = `control ${TOGGLE_CLASS}`;
		toggle.dataset.tooltip = "Меню";
		toggle.setAttribute("aria-label", "Меню");
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

	// Переносим кнопки в меню. appendChild перемещает узел вместе с его обработчиками.
	for (const b of movable) menu.appendChild(b);
}

function openMenu(toggle, menu) {
	menu.hidden = false;

	// Меню — потомок окна (.window-app). Позиционируем его АБСОЛЮТНО относительно окна,
	// а не вьюпорта: окно при перетаскивании двигается через transform, и transform у
	// предка превращает position:fixed в позиционирование относительно этого предка —
	// отсюда и был «уезд вправо»/«не появляется». При position:absolute меню привязано
	// к самому окну. Координаты берём как РАЗНОСТЬ двух getBoundingClientRect (кнопка и
	// окно): взаимное смещение от transform в разности сокращается, позиция точна при любом drag.
	const root = menu.closest(".window-app, .application") ?? menu.parentElement;
	const tr = toggle.getBoundingClientRect();
	const rr = root.getBoundingClientRect();
	menu.style.position = "absolute";
	menu.style.top = `${tr.bottom - rr.top + 2}px`; // сразу под кнопкой
	menu.style.right = `${Math.max(0, rr.right - tr.right)}px`; // правым краем под кнопку
	menu.style.left = "auto";
	menu.style.maxHeight = `${Math.max(120, rr.bottom - tr.bottom - 12)}px`; // не вылезать за низ окна

	// Закрытие по клику вне меню.
	menu._onDoc = (ev) => {
		if (!menu.contains(ev.target) && !toggle.contains(ev.target)) closeMenu(menu);
	};
	// Выбор пункта тоже закрывает меню.
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
 * Следит за шапкой: если модуль добавит кнопку позже (асинхронно), мы её тоже подберём.
 * На время собственного переноса observer отключаем, чтобы не зациклиться.
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
