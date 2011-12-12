/**
 * xhrForm
 * 
 * submits form values via XHR
 * responses can trigger a "normal" submit, a redirect or
 * will contain objects with name of elements, new values and
 * possible error messages
 * 
 * @version 0.3.0 2011-10-26
 * @author Gregor Kofler, info@gregorkofler.at
 * 
 * @param {Object} form element
 * @param {Object} xhr request configuration object
 * 
 * @todo improve enableSubmit(), disableSubmit()
 */

vxJS.widget.xhrForm = function(form, xhrReq) {

	if (!form.nodeName || form.nodeName.toLowerCase() != "form") {
		throw new Error("widget.xhrForm: no form element specified!");
	}

	var	prevErr = [], msgBoxes = [], that = {},
		apcHidden, apcProgressBar, apcPercentage, apcPollTimeout,
		submittingElement, ifrm, submittedByApp, submittingNow,
		xhr = vxJS.xhr(xhrReq), lastXhrResponse, xhrImgSize,
		xhrImg = function() {
			var i = "div".setProp("class", "vxJS_xhrThrobber").create();
			i.style.position = "absolute";
			vxJS.dom.setElementPosition(i,  { x: -100, y: -100 } );
			document.body.appendChild(i);
			return i;
		}();

	var posXhrImg = function() {
		var p, s;

		if(!submittingElement) {
			return;
		}
		if(!xhrImgSize) {
			xhrImgSize = vxJS.dom.getElementSize(xhrImg);
		}
		p = vxJS.dom.getElementOffset(submittingElement);
		s = vxJS.dom.getElementSize(submittingElement);
		p.x += s.x+4;
		p.y += (s.y-xhrImgSize.y)/2;
		vxJS.dom.setElementPosition(xhrImg, p);
	};

	var disableSubmit = function() {
		submittingNow = true;
	};

	var enableSubmit = function() {
		submittingNow = false;
	};

	var ifuLoaded = function() {
		var response;

		if(submittedByApp) {
			try			{ response = JSON.parse((ifrm.contentDocument || ifrm.contentWindow.document).body.innerHTML); }
			catch(e)	{ response = {}; }
	
			if(apcPollTimeout) {
				window.clearTimeout(apcPollTimeout);
				hideApcInfo();
			}

			xhrImg.style.display = "none";
			enableSubmit();

			vxJS.event.serve(that, "ifuResponse", response);

			handleXhrResponse(response);
		}
	};

	var prepareIfu = function() {
		var action = form.action, div, s, name = "ifu_" + Math.uuid();

		if(ifrm) { return; }

		ifrm = "iframe".setProp([["name", name], ["src", "javascript:false;"]]).create();
		div = "div".create(ifrm);
		s = div.style;
		s.visibility = "hidden";
		s.overflow = "hidden";
		vxJS.dom.setElementSize(div, new Coord(0, 0));
		document.body.appendChild(div);

		form.target = name;
		form.action = action + (action.indexOf("?") == -1 ? "?" : "&") +"ifuRequest=" + xhrReq.command;

		vxJS.event.addListener(ifrm, "load", ifuLoaded);
	};

	var setValues = function(v) {
		var i, j, elements = form.elements;

		for(i = v.length; i--;) {
			if(!(e = elements[v[i].name])) {
				continue;
			}

			switch(e.type) {
				case 'textarea':
				case 'text':
				case "hidden":
					e.value = v[i].value;
					break;

				case 'select-multiple':
					if(typeof v[i].value != "object" || !v[i].value.length) { break; }
					for(j = e.options.length; j--;) {
						 e.options[j].selected = v[i].value.inArray(e.options[j].value);
					}
					break;

				case 'select-one':
					e.selectedIndex = isNaN(+v[i].value) ? null : +v[i].value;
					break;

				case 'radio':
				case 'checkbox':
					e.checked = v[i].value ? true : false;
			}
		}
	};

	var clearErrors = function() {
		prevErr.forEach(function(e) {
			var n;
			e.elements.forEach(function(elem) { vxJS.dom.removeClassName(elem, "error"); });
			if((n = document.getElementById("error_"+e.name))) {
				vxJS.dom.removeClassName(n, "error");
				if(e.text) {
					n.removeChild(n.lastChild);
				}
			}
		});
	};

	var setErrors = function(err) {
		err.forEach(function(e) {
			var element = form.elements[e.name], n;

			if(!element) {
				e.elements = [];
			}
			else if(element.nodeName) {
				e.elements = [element];
				vxJS.dom.addClassName(element, "error");
			}
			else {
				e.elements = vxJS.collectionToArray(element);
				e.elements.forEach(function(elem) {vxJS.dom.addClassName(elem, "error"); });
			}

			if((n = document.getElementById("error_"+e.name))) {
				vxJS.dom.addClassName(n, "error");
				if(e.text) {
					n.appendChild(document.createTextNode(e.text));
				}
			}
		});

		prevErr = err;
	};

	var getValues = function(fe, submit) {
		var	 i, v, j, o, vals = {}, e;

		for (i = fe.length; i--;) {
			v = null;
			e = fe[i];
			if (e.type && !e.disabled) {
				switch (e.type) {
					case "radio":
					case "checkbox":
						if (e.checked) {
							v = e.value;
						}
						break;
						
					case "textarea":
					case "text":
					case "password":
					case "hidden":
						v = e.value;
						break;
						
					case "select-multiple":
						o = e.options;
						v = [];
						for (j = o.length; j--;) {
							if (o[j].selected) {
								v.push(o[j].value);
							}
						}
						break;
						
					case "select-one":
						v = e.options[e.selectedIndex].value;
						break;
						
					case "submit":
					case "image":
					case "button":
						if (submit && e === submit) {
							v = e.value;
						}
				}
				if (v !== null) {
					vals[e.name] = v;
				}
			}
		}
		return vals;
	};
	
	var clearMsgBoxes = function() {
		msgBoxes.forEach(function(b) {vxJS.dom.deleteChildNodes(b.container);});
	};
	
	var findMsgBox = function(id) {
		for(var i = msgBoxes.length; i--;) {
			if (id === msgBoxes[i].id) {
				return msgBoxes[i].container;
			}
		}
	};

	// APC functionality

	var hideApcInfo = function(){
		if(!apcPercentage && !apcProgressBar) {
			return;
		}
		if(apcPercentage)	{ apcPercentage.style.display = "none"; }
		if(apcProgressBar)	{ apcProgressBar.style.display = "none"; }
	};

	var showApcInfo = function() {
		if(!apcPercentage && !apcProgressBar) {
			return;
		}
		if(apcPercentage)	{ apcPercentage.style.display = ""; }
		if(apcProgressBar)	{ apcProgressBar.style.display = ""; }
	};

	var updateApcInfo = function(r) {
		if(!apcPercentage && !apcProgressBar) {
			return;
		}

		var	p = (r.total && r.current) ? (r.current/r.total * 100).toFixed() : 0,
			f = r.filename;

		if(apcPercentage) {
			apcPercentage.firstChild.nodeValue = p + "%";
		}
		if(apcProgressBar) {
			apcProgressBar.firstChild.style.width = p + "%";
		}
	};

	var apcPoll = function() {
		var xhr;

		showApcInfo();

		var parseApc = function() {
			var r = this.response;

			if(!r || r.cancel_upload) {
				window.clearTimeout(apcPollTimeout);
				vxJS.event.serve("apcFinish", that);
				hideApcInfo();
			}
			else {
				vxJS.event.serve("apcUpdate", that);
				updateApcInfo(r);
			}
		};

		(function() {
			if(!xhr) {
				xhr = vxJS.xhr({ command: "apcPoll" }, { id: apcHidden.value });
				vxJS.event.addListener(xhr, "complete", parseApc);
			}
			else {
				xhr.use();
			}
			apcPollTimeout = window.setTimeout(arguments.callee, 1000); 
		})();
	};

	/**
	 * handle response
	 * 
	 * can handle commands (redirect, submit),
	 * set values of elements and corresponding errors
	 * fill message boxes, serve event
	 */
	var handleXhrResponse = function(response) {
		var i, n, v = [], e = [], m, c, cmd, r = response || this.response;

		clearMsgBoxes();
		clearErrors();

		if((cmd = r.command)) {
			setErrors([]);
			if(cmd == "redirect" && r.location) {
				window.location.href = r.location;
				return;
			}
			if(cmd == "submit") {
				if(apcHidden) {
					apcPoll();
				}
				posXhrImg();
				xhrImg.style.display = "";
				submittedByApp = true;
				disableSubmit();
				form.submit();
				return;
			}
		}

		if(r.elements) {
			for(i = r.elements.length; i--;) {
				n = r.elements[i].name;
				if(r.elements[i].value) { v.push({name: n, value: r.elements[i].value }); }
				if(r.elements[i].error) { e.push({name: n, text: r.elements[i].errorText || null}); }  
			}
			setValues(v);
			setErrors(e);
		}
		
		if((m = r.msgBoxes)) {
			for (i = m.length; i--;) {
				if(m[i].id && (c = findMsgBox(m[i].id))) {
					c.appendChild(vxJS.dom.parse(m[i].elements));
				}
			}
		}

		lastXhrResponse = r;
		vxJS.event.serve(that, "check", r);
	};

	var handleClick = function(e) {

		vxJS.event.preventDefault(e);

		if(submittingNow) {
			return;
		}
		submittingElement = this;

		posXhrImg();
		xhr.use(null, { elements: getValues(form.elements, this) }, { node: xhrImg });
		xhr.submit();
	};

	that.addSubmit = function(elem) {
		var f;

		if(elem.nodeName === "INPUT" && (!(f = elem.form || vxJS.dom.getParentElement(elem, "form")) || f !== form)) {
			throw Error("widget.xhrForm: form element not found!");
		}

		vxJS.event.addListener(elem, "click", handleClick);
	};

	that.addMessageBox = function(elem, id) {
		if(!elem) { return; }
		msgBoxes.push({
			container: elem,
			id: id || "MsgBox" + msgBoxes.length
		});
	};

	that.clearErrors = function() {
		setErrors([]);
	};

	that.clearFileInputs = function() {
		var inp = form.getElementsByTagName("input"), i;

		if(!inp || !(i = inp.length)) { return; }

		for(; --i;) {
			if(inp[i].type == "file") {
				inp[i].parentNode.replaceChild(
					"input".setProp([["type", "file"], ["name", inp[i].name]]).create(),
					inp[i]);
			}
		}
	};

	that.forceRequest = function() {
		xhr.use(null, { elements: getValues(form.elements, this) }, { node: null } );
		xhr.submit();
	};

	that.enableApcUpload = function() {
		if(typeof apcHidden === "undefined") {
			apcHidden = function() {
				var apc;
				if(form.enctype !== "multipart/form-data" || !(apc = form.elements["APC_UPLOAD_PROGRESS"])) {
					return false;
				}
				return apc;
			}();

			if(apcHidden) {
				apcProgressBar = function() {
					var e = vxJS.dom.getElementsByClassName("apcProgressBar", form, "div")[0];
					if(e) {
						vxJS.dom.cleanDOM(e);
						return e;
					}
				}();

				apcPercentage = function() {
					var e = vxJS.dom.getElementsByClassName("apcPercentage", form, "span")[0];
					if(e) {
						e.appendChild(document.createTextNode(""));
						return e;
					}
				}();

				hideApcInfo();
			}
		}
	};

	that.enableIframeUpload = function() {
		prepareIfu();
	};

	that.getLastXhrResponse = function() {
		return lastXhrResponse;
	};

	vxJS.event.addListener(xhr, "complete", handleXhrResponse);
	vxJS.event.addListener(xhr, "timeout", function() { window.alert("Response took to long!");});

	that.element = form;

	return that;
};