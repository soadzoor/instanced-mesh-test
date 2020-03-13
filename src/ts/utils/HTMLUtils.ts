export class HTMLUtils
{
	/**
	 * offsetXY is not widely supported by the browsers yet
	 */
	public static clientXYToOffsetXY(element: HTMLElement, x: number, y: number)
	{
		const boundingClientRect = element.getBoundingClientRect();
		return {
			x: x - boundingClientRect.left,
			y: y - boundingClientRect.top
		};
	}

	public static getSize(element: Element)
	{
		return element.getBoundingClientRect();
	}

	/**
	 * Removes every child of the element
	 * @param element HTMLElement
	 */
	public static clearElement(element: Element, alsoRemoveFromDom: boolean = false)
	{
		while (element.lastChild)
		{
			element.removeChild(element.lastChild);
		}

		if (alsoRemoveFromDom)
		{
			HTMLUtils.removeElementFromDOM(element);
		}
	}

	/**
	 * Removes element from DOM
	 * @param element HTMLelement
	 */
	public static removeElementFromDOM(element: Element)
	{
		if (element.parentElement)
		{
			element.parentElement.removeChild(element);
		}
	}

	/**
	 * Returns true if parent contains child
	 * @param parent 
	 * @param child 
	 * @param acceptIfSame
	 */
	public static isDescendant(parent: Element, child: Element, acceptIfSame: boolean = true)
	{
		let node = acceptIfSame ? child : child.parentElement;

		while (node != null)
		{
			if (node === parent)
			{
				return true;
			}
			node = node.parentElement;
		}

		return false;
	}
}