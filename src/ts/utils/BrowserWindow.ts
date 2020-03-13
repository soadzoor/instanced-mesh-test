
import {ConversionUtils} from "./ConversionUtils";


declare global
{
	interface Document
	{
		selection: {
			empty(): void;
		}
	}
}


export class BrowserWindow
{
	// --------------------------------------------------------------------------------------------------
	// localStorage, cache

	public static setLocalStorageItem(key: string, value: string)
	{
		// on iOS setItem may throw an error in private browsing
		// http://stackoverflow.com/questions/21159301/quotaexceedederror-dom-exception-22-an-attempt-was-made-to-add-something-to-st
		// TODO: a fallback could be added in case of error

		try
		{
			localStorage.setItem(key, value);
		}
		catch (error)
		{
			console.log("localStorage error:", error);
		}
	}

	public static getLocalStorageItem(key: string): string
	{
		return localStorage.getItem(key);
	}

	// --------------------------------------------------------------------------------------------------
	// Platform detection

	public static inBrowser(): boolean
	{
		return !BrowserWindow.onNode();
	}

	public static onNode(): boolean
	{
		return typeof window === "undefined";
	}

	public static getURLPathWithoutQuery()
	{
		return location.protocol + "//" + location.host + location.pathname;
	}

	private static _isDesktop: boolean = undefined;

	public static isDesktop(): boolean
	{
		if (BrowserWindow._isDesktop === undefined)
		{
			BrowserWindow._isDesktop = ! (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/));
		}

		return BrowserWindow._isDesktop;
	}

	public static isIE()
	{
		return !!navigator.userAgent.match(/Trident/);
		// navigator.userAgent.indexOf("Trident/7.0")
	}

	public static isEdge()
	{
		return /Edge\/\d./i.test(navigator.userAgent);
		// navigator.userAgent.indexOf("Edge") > -1
	}

	public static isMS()
	{
		return this.isIE() || this.isEdge();
	}

	// --------------------------------------------------------------------------------------------------
	// Query params

	public static getQueryParams(): any
	{
		if (!BrowserWindow.inBrowser())
		{
			// we"re on node
			return {};
		}
		return ConversionUtils.htmlDecode(window.location.search);
	}

	// --------------------------------------------------------------------------------------------------
	// Scroll functions

	public static getScrollX(): number
	{
		return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
	}

	public static getScrollY(): number
	{
		return window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop  || 0;
	}

	// --------------------------------------------------------------------------------------------------
	// Clear

	public static clearSelection()
	{
		if (window.getSelection)
		{
			const selection = window.getSelection();

			if (selection.empty)
			{
				// Chrome
				selection.empty();
			}
			else if (selection.removeAllRanges)
			{
				// FireFox
				selection.removeAllRanges();
			}
		}
		else if (document.selection)
		{
			// old IE
			document.selection.empty();
		}
	}

	public static selectAll(element: HTMLElement)
	{
		const range = document.createRange();
		range.selectNodeContents(element);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}

	public static setCaretPosition(element: any, caretPos: number)
	{
		if(element)
		{
			if(element.createTextRange)
			{
				const range = element.createTextRange();
				range.move("character", caretPos);
				range.select();
			}
			else
			{
				if(element.selectionStart)
				{
					element.focus();
					element.setSelectionRange(caretPos, caretPos);
				}
				else
				{
					element.focus();
				}

				element.blur();
			}
		}
	}

	// --------------------------------------------------------------------------------------------------
	// Clipboard

	public static copyToClipboard(data: any)
	{
		const textArea = document.createElement("textarea");
		textArea.value = data;

		document.body.appendChild(textArea);

		textArea.select();

		try
		{
			const successful = document.execCommand("copy");
			const msg = successful ? "successful" : "unsuccessful";
			console.log("Copying text command was " + msg);
		}
		catch (err)
		{
			console.log("Error: unable to copy");
		}

		document.body.removeChild(textArea);
	}

	// --------------------------------------------------------------------------------------------------
	// WebGL support

	/**
	 * Detects if WebGL is supported.
	 * @returns the context and the contextId if WebGL is supported, null otherwise.
	 */
	public static detectWebGL(canvas?: HTMLCanvasElement): {name: string; gl: WebGLRenderingContext}
	{
		if (!!window["WebGLRenderingContext"])
		{
			canvas = canvas || document.createElement("canvas");
			const names = ["webgl", "experimental-webgl", "moz-webgl", "webkit-3d"];
			let context: WebGLRenderingContext = null;

			for (const name of names)
			{
				try
				{
					context = <WebGLRenderingContext> canvas.getContext(name);
					if (context && typeof context["getParameter"] == "function")
					{
						// WebGL is enabled
						// return WebGL object if the function"s argument is present
						return {
							name: name,
							gl: context
						};
					}
				}
				catch (e)
				{
				}
			}

			// WebGL is supported, but disabled
			return null;
		}

		// WebGL not supported
		return null;
	}

	// --------------------------------------------------------------------------------------------------
	// System info

	public static getSystemInfo(): any
	{
		const result = {};

		BrowserWindow.addProperties(result, window.navigator, "", [
			"appCodeName",
			"appName",
			"appVersion",
			"cookieEnabled",
			"doNotTrack",
			"hardwareConcurrency",
			"language",
			"maxTouchPoints",
			"platform",
			"product",
			"productSub",
			"userAgent",
			"vendor",
			"vendorSub"
		]);

		BrowserWindow.addProperties(result, window.screen, "screen_", [
			"width",
			"height",
			"availHeight",
			"availWidth",
			"availTop",
			"availLeft",
			"colorDepth",
		]);

		const orientation = window.screen && window.screen["orientation"];
		if (orientation)
		{
			result["orientation_angle"] = orientation.angle;
			result["orientation_type"]  = orientation.type;
		}

		result["screenX"] = window.screenX;
		result["screenY"] = window.screenY;

		// convert it to boolean (the context instance might not be able to be sent through XHR)
		result["WebGL"] = !!BrowserWindow.detectWebGL();

		return result;
	}

	private static addProperties(result: any, object: any, prefix, keys: string[])
	{
		if (object)
		{
			for (const key of keys)
			{
				result[prefix + key] = object[key];
			}
		}
	}

	// --------------------------------------------------------------------------------------------------
	// Navigation utils

	public static redirectToURL(url: string)
	{
		window.location.href = url;
	}

	public static open(url: string, target?: string, features?: string, replace?: boolean)
	{
		return window.open(url, target, features, replace);
	}
}
