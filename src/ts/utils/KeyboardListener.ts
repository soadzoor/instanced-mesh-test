
import {Signal} from "./signal/Signal";

/**
 * TODO
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
 * "keypress"
 */
export class KeyboardListener
{
	private static _isCtrlDown: boolean = false;
	private static _isShiftDown: boolean = false;
	private static _isAltDown: boolean = false;
	private static _isTabDown: boolean = false;

	public static instance: KeyboardListener;
	public static getInstance(): KeyboardListener
	{
		return KeyboardListener.instance || (KeyboardListener.instance = new KeyboardListener());
	}

	/**
	 * Returns if we allow the given event as keyboard event.
	 * We don't allow it if the current focus is on an input/textarea because in that case
	 * the user is typing and we don't want to mess with that.
	 */
	public static allowEvent(event: KeyboardEvent)
	{
		if (event.key === KeyboardListener.KEY_ESCAPE || event.key === KeyboardListener.KEY_ENTER)
		{
			return true;
		}

		const target = <HTMLElement> event.target;
		const name = target.nodeName.toLowerCase();

		if (name === "input" || name === "textarea" || document.querySelectorAll(":focus").length > 0)
		{
			// Currently the focus is on an
			return false;
		}

		return true;
	}

	public static KEY_DOWN      = "ArrowDown";
	public static KEY_UP        = "ArrowUp";
	public static KEY_LEFT      = "ArrowLeft";
	public static KEY_RIGHT     = "ArrowRight";
	public static KEY_ESCAPE    = "Escape";
	public static KEY_DELETE    = "Delete";
	public static KEY_BACKSPACE = "Backspace";
	public static KEY_ENTER     = "Enter";
	public static KEY_SPACE     = " ";
	public static KEY_TAB       = "Tab";
	public static KEY_CTRL      = "Control";
	public static KEY_SHIFT     = "Shift";
	public static KEY_ALT       = "Alt";

	public signals = {
		down      : Signal.create<KeyboardEvent>(),
		up        : Signal.create<KeyboardEvent>(),
		windowBlur: Signal.create<Event>() // AKA: focus is lost -> the user clicked outside the browser, or changed tabs, or something similar
	};

	protected _domElement: any;

	constructor(domElement?: HTMLElement)
	{
		this._domElement = domElement || document.body;

		this.setEnabled(true);
	}

	public setEnabled(value: boolean)
	{
		if (value)
		{
			this.addListeners();
		}
		else
		{
			this.removeListeners();
		}
	}

	protected addListeners()
	{
		this._domElement.addEventListener("keydown", this.onKeyDown);
		this._domElement.addEventListener("keyup",   this.onKeyUp);
		window.addEventListener("blur", this.windowBlur);
	}

	protected removeListeners()
	{
		this._domElement.removeEventListener("keydown", this.onKeyDown);
		this._domElement.removeEventListener("keyup",   this.onKeyUp);
		window.removeEventListener("blur", this.windowBlur);
	}

	private windowBlur = (event: Event) =>
	{
		this.resetFlags();
		this.signals.windowBlur.dispatch(event);
	};

	private resetFlags()
	{
		KeyboardListener._isAltDown =
		KeyboardListener._isCtrlDown =
		KeyboardListener._isShiftDown =
		KeyboardListener._isTabDown = false;
	}

	private onKeyDown = (event: KeyboardEvent) =>
	{
		switch(event.key)
		{
			case KeyboardListener.KEY_ALT:
				KeyboardListener._isAltDown = true;
				break;
			case KeyboardListener.KEY_CTRL:
				KeyboardListener._isCtrlDown = true;
				break;
			case KeyboardListener.KEY_SHIFT:
				KeyboardListener._isShiftDown = true;
				break;
			case KeyboardListener.KEY_TAB:
				KeyboardListener._isTabDown = true;
				break;
		}

		if (this.allow(event))
		{
			this.signals.down.dispatch(event);
		}

		// This is not a good idea, users might add enter listener in keydown.dispatch
		// if (event.key === KeyboardListener.KEY_ESCAPE)
		// {
		// 	this.escape.dispatch(event);
		// }
		// else if (event.key === KeyboardListener.KEY_DELETE)
		// {
		// 	this.delete.dispatch(event);
		// }
		// else if (event.key === KeyboardListener.KEY_ENTER)
		// {
		// 	this.enter.dispatch(event);
		// }
	}

	private onKeyUp = (event: KeyboardEvent) =>
	{
		switch(event.key)
		{
			case KeyboardListener.KEY_ALT:
				KeyboardListener._isAltDown = false;
				// When alt is released, a blur event is triggered, so we need to prevent that
				// Consider preventdefault regardless of which key was released..?
				event.preventDefault();
				break;
			case KeyboardListener.KEY_CTRL:
				KeyboardListener._isCtrlDown = false;
				break;
			case KeyboardListener.KEY_SHIFT:
				KeyboardListener._isShiftDown = false;
				break;
			case KeyboardListener.KEY_TAB:
				KeyboardListener._isTabDown = false;
				break;
		}

		if (this.allow(event))
		{
			this.signals.up.dispatch(event);
		}
	}

	protected allow(event: KeyboardEvent)
	{
		return KeyboardListener.allowEvent(event);
	}

	public get element()
	{
		return this._domElement;
	}

	public static get isAltDown()
	{
		return KeyboardListener._isAltDown;
	}

	public static get isCtrlDown()
	{
		return KeyboardListener._isCtrlDown;
	}

	public static get isShiftDown()
	{
		return KeyboardListener._isShiftDown;
	}

	public static get isTabDown()
	{
		return KeyboardListener._isTabDown;
	}

	public dispose()
	{
		this.removeListeners();
	}
}
