import {Signal} from "./signal/Signal";
import {PointerDetector, Pointer} from "./PointerDetector";

export interface IGesture
{
	listen(): void;
	complete(): void;
	//signal: Signal;
}

export interface IPinchZoomGestureData
{
	pointer1: Pointer;
	pointer2: Pointer;
	startDistance: number;
	distance: number;
}

/**
 * Main logic here:
 * - check if number of pointers changes (pointer is pressed / released)
 * - if 2 pointers are pressed: activate pinch zoom, otherwise: deactivate
 * - dispatch start, update, end events.
 */
export class PinchZoomGesture implements IGesture
{
	public signals = {
		start  : Signal.create<IPinchZoomGestureData>(),
		update : Signal.create<IPinchZoomGestureData>(),
		end    : Signal.create<IPinchZoomGestureData>(),
	};

	private _pointerDetector: PointerDetector;
	private _active: boolean = false;

	private _moveData: IPinchZoomGestureData; // reuse

	constructor(pointerDetector: PointerDetector)
	{
		this._pointerDetector = pointerDetector;

		this._moveData = {
			pointer1: null,
			pointer2: null,
			startDistance: 0,
			distance: 0
		};
	}

	public listen()
	{
		this._pointerDetector.signals.down.add(this.onPointerUpOrDown, this);
		this._pointerDetector.signals.  up.add(this.onPointerUpOrDown, this);
	}

	public complete()
	{
	}

	private onPointerUpOrDown()
	{
		const pointersLength = this._pointerDetector.pointersLength;

		if (!this._active && pointersLength === 2)
		{
			this.activate();
		}
		else if (this._active && pointersLength !== 2)
		{
			this.deactivate();
		}
	}

	private activate()
	{
		this._active = true;

		this._moveData.pointer1 = this._pointerDetector.pointerArray[0];
		this._moveData.pointer2 = this._pointerDetector.pointerArray[1];

		const distance = this.calculateDistance();
		this._moveData.startDistance = distance;
		this._moveData.distance = distance;

		this.signals.start.dispatch(this._moveData);

		this._pointerDetector.signals.move.add(this.onPointerMove, this);
	}

	private deactivate()
	{
		this._active = false;

		this.refreshDistance();
		this.signals.end.dispatch(this._moveData);
	}

	protected onPointerMove()
	{
		// this._active should always be true because we only attach the listener in activate
		if (this._active)
		{
			this.refreshDistance();
			this.signals.update.dispatch(this._moveData);
		}
	}

	private refreshDistance()
	{
		const distance = this.calculateDistance();
		this._moveData.distance = distance;
	}

	private calculateDistance()
	{
		const pointer1 = this._moveData.pointer1;
		const pointer2 = this._moveData.pointer2;

		const dx = pointer1.localX - pointer2.localX;
		const dy = pointer1.localY - pointer2.localY;

		return Math.sqrt(dx * dx + dy * dy);
	}

	public get lastData()
	{
		return this._moveData;
	}
}
