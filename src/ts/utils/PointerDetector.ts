import {BrowserWindow} from "./BrowserWindow";
import {ObjectUtils} from "./ObjectUtils";
import {Constants} from "./Constants";
import {Signal, ISignal} from "./signal/Signal";

export type MouseOrTouchEvent = MouseEvent | TouchEvent

export interface IPointerEventData // = MouseEvent | Touch;
{
	target   : EventTarget;

	clientX  : number;
	clientY  : number;
	pageX    : number;
	pageY    : number;
	screenX  : number;
	screenY  : number;
}

// TODO implement this
export enum UpdateMode
{
	IMMEDIATE = 0,
	REQUEST_ANIMATION_FRAME = 1,
	MANUAL = 2
}

export interface IPointerDetectorConfig
{
	element                   : Element;
	parent                   ?: Element;
	maxPointers              ?: number;
	convertToViewportPixels  ?: boolean;
	dispatchIndividualEvents ?: boolean;
	dispatchMultiEvents      ?: boolean;
	autoEnable               ?: boolean;
	updateMode               ?: UpdateMode;
	useTiming                ?: boolean;
	disableContextMenu       ?: boolean;
	ignoreRightButton        ?: boolean;
	ignoreMiddleButton       ?: boolean;
	handleAlertConfirm       ?: boolean; // Could be implemented
	// TODO preventDefault           ? : boolean;
}



export interface IPointerConfig
{
	id            ?: number;
	localX        ?: number;
	localY        ?: number;
	pageX         ?: number;
	pageY         ?: number;
	time          ?: number;
	originalEvent ?: MouseEvent | TouchEvent;
	pointerData   ?: IPointerEventData;
	currentTarget ?: Element;
}

// TODO static method to create Pointer from Event
export class Pointer
{

	public id     : number;
	public startX : number;
	public startY : number;
	// TODO rename x, y, make it a class?
	public localX : number;
	public localY : number;
	public time   : number;

	public pageX  : number;
	public pageY  : number;

	public originalEvent : MouseEvent | TouchEvent;
	public pointerData   : IPointerEventData;
	public currentTarget : Element;

	public canceled : boolean = false;

	public offsetX : number = 0;
	public offsetY : number = 0;
	public dx : number = 0;
	public dy : number = 0;
	public userData : any;

	constructor(config?: IPointerConfig)
	{
		if (config)
		{
			this.id            = config.id;
			this.startX        = config.localX;
			this.startY        = config.localY;
			this.localX        = config.localX;
			this.localY        = config.localY;
			this.pageX         = config.pageX;
			this.pageY         = config.pageY;
			this.time          = config.time;
			this.originalEvent = config.originalEvent;
			this.pointerData   = config.pointerData;
			this.currentTarget = config.currentTarget;
		}
	}

	public clone()
	{
		const cloned = new Pointer();

		// TODO this is maybe not too nice
		for (let key in this)
		{
			if (this.hasOwnProperty(key))
			{
				cloned[<any>key] = this[key];
			}
		}

		return cloned;
	}

	// TODO rename to isNormalButton
	public get isNormalClick()
	{
		return this.button <= Constants.MOUSE_BUTTON.LEFT;
	}

	public get isRightClick()
	{
		return this.button === Constants.MOUSE_BUTTON.RIGHT;
	}

	public get isMiddleClick()
	{
		return this.button === Constants.MOUSE_BUTTON.MIDDLE;
	}

	public get button()
	{
		if (this.isMouse)
		{
			const mouseEvent = <MouseEvent>this.originalEvent;
			if (mouseEvent.button === undefined)
			{
				// unsupported by browser
				return -1;
			}
			else
			{
				return mouseEvent.button;
			}
		}
		else
		{
			return -1;
		}
	}

	public get isMouse()
	{
		return this.id === 1;
	}

	public get isTouch()
	{
		return !this.isMouse;
	}
}






/**
 * This class unified mouse and touch events to be handled uniformly as pointer events.
 * id will be 1 for mouse events, the rest will be used for touches (2, 3, ...).
 *
 * This dispatches a separate event for each finger even when touched simultaneously. This
 * could be considered to be configurable to dispatch just one event and have the number
 * of fingers in the event data.
 *
 * You can use multiple instances of this class on the same canvas, and call
 * stopImmediatePropagation() on the original event, or you can use the same
 * instance and set pointerEvent.stopped to true to stop propagation.
 *
 * No gesture recognition is implemented here (that can be done in subclasses).
 *
 * screenX: device pixels (not css pixels)!
 *
 * Notes:
 *  - touches: all
 *  - targetTouches: the ones that started out in the same node (where we added the listener to?)
 *  - changedTouches: the ones involved in the event
 *
 * Resources:
 * http://www.polymer-project.org/platform/pointer-events.html
 * http://smus.com/mouse-touch-pointer/#
 * http://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
 * https://plus.google.com/u/0/115788095648461403871/posts/Ny6ZXuzWdN5
 * http://blogs.msdn.com/b/davrous/archive/2013/02/20/handling-touch-in-your-html5-apps-thanks-to-the-pointer-events-of-ie10-and-windows-8.aspx
 * https://developers.google.com/events/io/sessions/361772634
 *
 * Google I/O 2013 - Point, Click, Tap, Touch - Building Multi-Device Web Interfaces
 * https://www.youtube.com/watch?v=DujfpXOKUp8
 *
 * @param element typically a HTMLCanvasElement but it can be anything that supports events.
 *
 * Consider:
 * - separating mouse / touch related code to external classes.
 * - optional requestAnimationFrame
 * - object pooling for events
 * - preventDefault
 * - simultaneous multi tap event
 * - using number[] instead of localX, localY
 * - TODO read http://blog.chromium.org/2016/05/new-apis-to-help-developers-improve.html
 *             https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
 *             https://groups.google.com/a/chromium.org/forum/#!topic/input-dev/MlXWnVGuYX8
 *
 * TODO signals?
 * TODO method to remove all signal listeners?
 *
 */
export class PointerDetector
{

	public static defaultConfig: IPointerDetectorConfig = {
		element: null,
		maxPointers: 5,
		convertToViewportPixels: undefined,
		dispatchIndividualEvents: true,
		dispatchMultiEvents: false,
		autoEnable: true,
		updateMode: UpdateMode.IMMEDIATE,
		useTiming: false,
		disableContextMenu: false,
		ignoreRightButton: true,
		ignoreMiddleButton: true
	};

	public signals = {
		down      : Signal.create<Pointer, ISignal>(),
		move      : Signal.create<Pointer, ISignal>(), // dispatched only when a move is occurring WITH a preceding down
		up        : Signal.create<Pointer, ISignal>(),

		leave     : Signal.create<Pointer, ISignal>(),

		// TODO this should be cleaned up
		// dispatched only when a move is occurring WITHOUT a preceding down (eg. mousemove without mousedown)
		hoverMove : Signal.create<Pointer, ISignal>(),
		anyUp     : Signal.create<Pointer, ISignal>(),
		anyMove   : Signal.create<Pointer, ISignal>(),

		// TODO is it needed?
		multi     : {
			down  : Signal.create<Pointer[], ISignal>(),
			move  : Signal.create<Pointer[], ISignal>(),
			up    : Signal.create<Pointer[], ISignal>(),
		}
	};

	public pointers: {[id: number]: Pointer};
	public pointerArray: Pointer[];

	private _config: IPointerDetectorConfig;

	private _touchTargets: EventTarget[] = [];

	private _lastPointer: Pointer;

	private _focusLost = false;

	// cache
	private _localCoords: [number, number];
	private _pageCoords: [number, number];

	constructor(config: IPointerDetectorConfig)
	{
		this._config = ObjectUtils.mergeConfig(PointerDetector.defaultConfig, config);

		if (this._config.convertToViewportPixels === undefined)
		{
			this._config.convertToViewportPixels = (config.element instanceof HTMLCanvasElement);
		}

		this.pointers = {};
		this.pointerArray = [];

		// cache
		this._localCoords = [0, 0];
		this._pageCoords = [0, 0];

		if (this._config.autoEnable)
		{
			this.enable();
		}
	}

	// ===========================================================================================================
	// Enable, disable

	public enable()
	{
		const element = this._config.element;

		if (!element)
		{
			return;
		}

		element.addEventListener("touchstart",  this.onTouchStart);

		// Note: we add touchmove, touchend listeners at touchstart only, and on e.target, not the element.
		// Otherwise target child element might receive the event and that might be removed
		// from the dom -> parent will never receive it (it won't bubble up) ->
		// the cycle (start->update->end) will be stuck (no end event).
		// This works because even if the event target is removed from the dom, it sill receives the events.

		element.addEventListener("mousedown",   this.onMouseDown);
		element.addEventListener("mousemove",   this.onHoverMove);
		element.addEventListener("touchmove",   this.onAnyTouchMove);

		element.addEventListener("mouseleave",  this.onMouseLeave);

		element.addEventListener("mouseup",     this.onAnyUp);
		element.addEventListener("touchend",    this.onAnyUp);
		element.addEventListener("touchcancel", this.onAnyUp);

		if (this._config.disableContextMenu)
		{
			element.addEventListener("contextmenu", this.onContextMenu);
		}
	}

	public disable()
	{
		const element = this._config.element;

		if (!element)
		{
			return;
		}

		element.removeEventListener("touchstart",  this.onTouchStart);
		element.removeEventListener("mousedown",   this.onMouseDown);
		element.removeEventListener("mousemove",   this.onHoverMove);
		element.removeEventListener("touchmove",   this.onAnyTouchMove);

		element.removeEventListener("mouseup",     this.onAnyUp);
		element.removeEventListener("touchend",    this.onAnyUp);
		element.removeEventListener("touchcancel", this.onAnyUp);

		this.removeTouchTargetListeners();
		element.removeEventListener("mousemove", this.onMouseMove);

		if (this._config.disableContextMenu)
		{
			element.removeEventListener("contextmenu", this.onContextMenu);
		}

		this.pointers = {};
		this.pointerArray = [];
	}

	private removeTouchTargetListeners()
	{
		for (let i = 0; i < this._touchTargets.length; ++i)
		{
			const touchTarget = this._touchTargets[i];

			touchTarget.removeEventListener("touchmove",   this.onTouchMove);
			touchTarget.removeEventListener("touchend",    this.onTouchEnd);
			touchTarget.removeEventListener("touchcancel", this.onTouchCancel);
		}

		this._touchTargets.length = 0;
	}

	private onHoverMove = (event: MouseEvent) =>
	{
		let pointer = this.pointers[1];
		if (!pointer)
		{
			if (this.signals.hoverMove.bindings.length > 0)
			{
				pointer = this.createPointer(1, event, event);
				this._lastPointer = pointer;
				this.signals.hoverMove.dispatch(pointer, this.signals.hoverMove);
			}	
		}
	};

	private onAnyTouchMove = (event: TouchEvent) =>
	{
		if (this.signals.anyMove.bindings.length > 0)
		{
			const pointer = this.createPointer(1, event.changedTouches[0], event);
			this._lastPointer = pointer;
			this.signals.anyMove.dispatch(pointer, this.signals.anyMove);
		}
	};


	private onAnyUp = (event: MouseEvent) =>
	{
		const pointer = this.createPointer(1, event, event);
		this._lastPointer = pointer;
		this.signals.anyUp.dispatch(pointer, this.signals.anyUp);
	};

	private onContextMenu = (event: MouseEvent) =>
	{
		event.preventDefault();
	};

	// ===========================================================================================================
	// Down

	public fakeStart(event: TouchEvent)
	{
		this.onTouchStart(event);
	}

	private onTouchStart = (event: TouchEvent) =>
	{
		// Without this, onMouseDown would also fire afterwards.
		// However, this unfortunately keeps the focus for the previous element,
		event.preventDefault();

		// So we make sure the previous element loses focus (otherwise an input would still keep the focus)
		const active = <HTMLElement>document.activeElement;
		if (active && active.blur)
		{
			active.blur();
		}

		const pointers: Pointer[] = [];

		for (let i = 0, ln = event.changedTouches.length; i < ln; ++i)
		{
			const touch = event.changedTouches[i];

			// identifier starts from 0 -> we add 2 (1 is for mouse)
			const pointer = this.onPointerDown(touch.identifier+2, touch, event);
			if (pointer)
			{
				// TODO ?
				//this.addTouchTarget(touch.target);

				pointers.push(pointer);
			}
		}

		if (pointers.length)
		{
			this.addTouchTarget(event.target);
		}

		if (this._config.dispatchMultiEvents)
		{
			this.signals.multi.down.dispatch(pointers, this.signals.multi.down);
		}
	};

	private addTouchTarget(touchTarget: EventTarget)
	{
		if (this._touchTargets.indexOf(touchTarget) === -1)
		{
			this._touchTargets.push(touchTarget);

			touchTarget.addEventListener("touchmove",   this.onTouchMove);
			touchTarget.addEventListener("touchend",    this.onTouchEnd);
			touchTarget.addEventListener("touchcancel", this.onTouchCancel);
		}
	}

	private onMouseDown = (event: MouseEvent) =>
	{
		// If we call preventDefault then current input will still be in focus
		// event.preventDefault();

		if (!this.allowButton(event))
		{
			return;
		}

		// This causes the previously focused element to still be in focus
		// if we press the mouse on the canvas:
		// event.preventDefault();

		// we only listen to move / up when mouse is down
		// need to add these on document (in case the mouse leaves the target dom)
		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("mouseup",   this.onMouseUp);

		this.onPointerDown(1, event, event);
	};

	private onMouseLeave = (event: MouseEvent) =>
	{
		const id = 1;
		const pointer = this.createPointer(id, event, event);

		if (!pointer)
		{
			return null;
		}

		const localCoords = this.getLocalCoords(event);

		const localX = localCoords[0];
		const localY = localCoords[1];

		pointer.dx = localX - pointer.localX;
		pointer.dy = localY - pointer.localY;
		pointer.offsetX = localX - pointer.startX;
		pointer.offsetY = localY - pointer.startY;
		pointer.localX = localX;
		pointer.localY = localY;
		pointer.pageX  = event.pageX;
		pointer.pageY  = event.pageY;

		pointer.originalEvent = event;
		pointer.pointerData   = event;

		if (this._config.dispatchIndividualEvents)
		{
			this.signals.leave.dispatch(pointer, this.signals.move);
		}

		this._lastPointer = pointer;

		return pointer;
	};

	private allowButton(event: MouseEvent)
	{
		if ((this._config.ignoreRightButton && event.button === Constants.MOUSE_BUTTON.RIGHT) ||
		    (this._config.ignoreMiddleButton && event.button === Constants.MOUSE_BUTTON.MIDDLE))
		{
			return false;
		}

		return true;
	}

	private onPointerDown(id: number, eventData: IPointerEventData, originalEvent: MouseOrTouchEvent)
	{
		if (this.pointers[id])
		{
			// pointer is already down -> this is a bug, could be caused by breakpoint with focusloss
			// -> we manually trigger a pointerUp
			// Note: what if new id is different?

			this.onPointerUp(id, eventData, originalEvent);
		}

		const maxPointers = this._config.maxPointers;
		if (maxPointers > -1 && this.pointersLength >= maxPointers)
		{
			// no more pointers allowed
			return null;
		}

		const pointer = this.createPointer(id, eventData, originalEvent);

		this.pointers[id] = pointer;
		this.pointerArray.push(pointer);

		if (this._config.dispatchIndividualEvents)
		{
			this.signals.down.dispatch(pointer, this.signals.down);
		}

		this._lastPointer = pointer;

		this.handleFocusLoss(id, eventData, originalEvent);

		return pointer;
	}

	private handleFocusLoss(id: number, eventData: IPointerEventData, originalEvent: MouseOrTouchEvent)
	{
		this._focusLost = !document.hasFocus();
		if (this._focusLost)
		{
			// This runs when a debugger breakpoint is reached and the browser stops there.
			// Unfortunately in this case window"s "blur" event doesn't fire at all, and the problem is
			// that onPointerUp is never called because the window has lost focus.

			window.addEventListener("focus", this.onFocusBack);

			document.removeEventListener("mousemove", this.onMouseMove);
			document.removeEventListener("mouseup",   this.onMouseUp);

			// There has to be an onPointerUp between 2 onPointerDowns
			this.onPointerUp(id, eventData, originalEvent);
		}
	}

	private onFocusBack = (event: FocusEvent) =>
	{
		window.removeEventListener("focus", this.onFocusBack);
		this._focusLost = false;
	};

	// ===========================================================================================================
	// Move

	private onMouseMove = (event: MouseEvent) =>
	{
		event.preventDefault();

		this.onPointerMove(1, event, event);
	};

	private onTouchMove = (event: TouchEvent) =>
	{
		// disable scrolling ?
		event.preventDefault();

		const pointers:Pointer[] = [];

		for (let i = 0, ln = event.changedTouches.length; i < ln; i++)
		{
			const touch = event.changedTouches[i];
			const pointer = this.onPointerMove(touch.identifier+2, touch, event);

			if (pointer)
			{
				pointers.push(pointer);
			}
		}

		if (this._config.dispatchMultiEvents)
		{
			this.signals.multi.move.dispatch(pointers, this.signals.multi.move);
		}
	};

	private onPointerMove(id: number, eventData: IPointerEventData, originalEvent: MouseOrTouchEvent)
	{
		const pointer = this.pointers[id];

		if (!pointer || this.signals.move.bindings.length < 1)
		{
			return null;
		}

		const localCoords = this.getLocalCoords(eventData);

		const localX = localCoords[0];
		const localY = localCoords[1];

		pointer.dx = localX - pointer.localX;
		pointer.dy = localY - pointer.localY;
		pointer.offsetX = localX - pointer.startX;
		pointer.offsetY = localY - pointer.startY;
		pointer.localX = localX;
		pointer.localY = localY;
		pointer.pageX = eventData.pageX;
		pointer.pageY = eventData.pageY;

		pointer.originalEvent = originalEvent;
		pointer.pointerData   = eventData;

		if (this._config.dispatchIndividualEvents)
		{
			this.signals.move.dispatch(pointer, this.signals.move);
		}

		this._lastPointer = pointer;

		this.handleFocusLoss(id, eventData, originalEvent);

		return pointer;
	}

	// ===========================================================================================================
	// Up

	private onMouseUp = (event: MouseEvent) =>
	{
		if (!this.allowButton(event))
		{
			return;
		}

		event.preventDefault();

		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("mouseup",   this.onMouseUp);

		this.onPointerUp(1, event, event);
	};

	private onTouchEnd = (event: TouchEvent) =>
	{
		this.onTouchFinish(event, false);
	};

	private onTouchCancel = (event: TouchEvent) =>
	{
		this.onTouchFinish(event, true);
	};

	/**
	 * Called at touchend and touchcancel
	 *
	 * Note: we shouldn't remove touchmove/end/cancel event listeners, because other pointers might be using it
	 */
	private onTouchFinish = (event: TouchEvent, canceled: boolean) =>
	{
		event.preventDefault();

		const pointers: Pointer[] = [];

		for (let i = 0, ln = event.changedTouches.length; i < ln; ++i)
		{
			const touch = event.changedTouches[i];
			const pointer = this.onPointerUp(touch.identifier+2, touch, event);

			if (pointer)
			{
				pointer.canceled = canceled;
				pointers.push(pointer);
			}
		}

		if (this._config.dispatchMultiEvents)
		{
			this.signals.multi.up.dispatch(pointers, this.signals.multi.up);
		}
	};

	private onPointerUp(id: number, eventData: IPointerEventData, originalEvent: MouseOrTouchEvent)
	{
		const pointer = this.pointers[id];

		if (!pointer)
		{
			return null;
		}

		// TODO try to remove from pointers as well
		const pointerArrayIndex = this.pointerArray.indexOf(pointer);
		if (pointerArrayIndex > -1)
		{
			this.pointerArray.splice(pointerArrayIndex, 1);
		}
		delete this.pointers[id];

		pointer.originalEvent = originalEvent;

		if (this._config.dispatchIndividualEvents)
		{
			this.signals.up.dispatch(pointer, this.signals.up);
		}

		this._lastPointer = pointer;

		return pointer;
	}

	// ===========================================================================================================
	// Pressed, moved data

	public createPointer(id: number, pointerData: IPointerEventData, originalEvent: MouseOrTouchEvent)
	{
		const localCoords = this.getLocalCoords(pointerData);

		const time = this._config.useTiming ? new Date().getTime() : 0;

		const pointer = new Pointer({
			id: id,
			localX: localCoords[0],
			localY: localCoords[1],
			pageX: pointerData.pageX,
			pageY: pointerData.pageY,
			time: time,
			originalEvent: originalEvent,
			pointerData: pointerData,
			currentTarget: this.config.element
		});

		return pointer;
	}

	/**
	 * (old note: This assumed proper support for pageX, pageY.)
	 * Used by this class but it can be called externally with a Touch / MouseEvent.
	 * @returns {number[]} the coordinates relative to the parent / element.
	 */
	public getLocalCoords(pointerData: IPointerEventData)
	{
		const target = this._config.parent || this._config.element;

		return PointerDetector.getLocalCoords(pointerData, target, this._config.convertToViewportPixels, this._localCoords);
	}

	public getPageCoords(event: MouseOrTouchEvent)
	{
		return PointerDetector.getPageCoords(event, this._pageCoords);
	}

	public static getLocalCoords(pointerData: IPointerEventData, element: Element, convertToViewportPixels = undefined, result: [number, number])
	{
		const clientRect = element.getBoundingClientRect();

		const left = clientRect.left + BrowserWindow.getScrollX();
		const top  = clientRect.top  + BrowserWindow.getScrollY();

		let localCoordX = pointerData.clientX - left; // was pageX before (but HelmetConfigurator didn't work on ios)
		let localCoordY = pointerData.clientY - top;  // was pageY before

		if (convertToViewportPixels === undefined)
		{
			convertToViewportPixels = element instanceof HTMLCanvasElement;
		}

		if (convertToViewportPixels)
		{
			// these are not rounded!
			const canvas  = <HTMLCanvasElement> element;

			// Note: using canvas.clientWidth or clientRect.width would cause
			// any border: 1px to be calculated which we don't want
			localCoordX = localCoordX * canvas.width  / canvas.scrollWidth;
			localCoordY = localCoordY * canvas.height / canvas.scrollHeight;
		}

		result[0] = localCoordX;
		result[1] = localCoordY;

		return result;
	}

	public static getPageCoords(event: MouseOrTouchEvent, result: [number, number])
	{
		if (event instanceof MouseEvent)
		{
			result[0] = event.pageX;
			result[1] = event.pageY;
		}
		else
		{
			// pageXY of the first touchpoint
			result[0] = event.touches[0].pageX;
			result[1] = event.touches[1].pageX;
		}

		return result;
	}

	// point coords are in [0,1] range
	public getLocalCoordsFromNormalizedPoint(point: number[])
	{
		const clientRect = this._config.element.getBoundingClientRect();

		const pageX = clientRect.left   + (clientRect.right - clientRect.left)   * point[0];
		const pageY = clientRect.bottom + (clientRect.top   - clientRect.bottom) * point[1];

		return this.getLocalCoords({
			pageX: pageX,
			pageY: pageY,
			target: null,
			clientX: null,
			clientY: null,
			screenX: null,
			screenY: null
		});
	}

	// ===========================================================================================================
	// Getters

	public get pointersLength()
	{
		//return this.pointerArray.length;

		return Object.keys(this.pointers).length;
	}

	public clonePointerArray(): Pointer[]
	{
		const result: Pointer[] = [];

		for (let i = 0; i < this.pointerArray.length; ++i)
		{
			result.push(this.pointerArray[i].clone());
		}

		return result;
	}

	public get config()
	{
		return this._config;
	}

	public get lastPointer()
	{
		return this._lastPointer;
	}

	public dispose()
	{
		this.disable();

		for (const key in this.signals)
		{
			if (this.signals[key].removeAll)
			{
				this.signals[key].removeAll();
			}
		}

		for (const key in this.signals.multi)
		{
			if (this.signals.multi[key].removeAll)
			{
				this.signals.multi[key].removeAll();
			}
		}
	}
}