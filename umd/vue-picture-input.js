(function(e, t) {
    "object" == typeof exports && "object" == typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : "object" == typeof exports ? exports.PictureInput = t() : e.PictureInput = t()
})("undefined" != typeof self ? self : this, function() {
    return function(e) {
        function t(n) {
            if (i[n]) return i[n].exports;
            var r = i[n] = {
                i: n,
                l: !1,
                exports: {}
            };
            return e[n].call(r.exports, r, r.exports, t), r.l = !0, r.exports
        }
        var i = {};
        return t.m = e, t.c = i, t.d = function(e, i, n) {
            t.o(e, i) || Object.defineProperty(e, i, {
                configurable: !1,
                enumerable: !0,
                get: n
            })
        }, t.n = function(e) {
            var i = e && e.__esModule ? function() {
                return e.default
            } : function() {
                return e
            };
            return t.d(i, "a", i), i
        }, t.o = function(e, t) {
            return Object.prototype.hasOwnProperty.call(e, t)
        }, t.p = "/", t(t.s = 1)
    }([function(e, t, i) {
        "use strict";

        function n(e, t) {
            if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function")
        }

        function r(e, t) {
            if (!e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
            return !t || "object" != typeof t && "function" != typeof t ? e : t
        }

        function a(e, t) {
            if ("function" != typeof t && null !== t) throw new TypeError("Super expression must either be null or a function, not " + typeof t);
            e.prototype = Object.create(t && t.prototype, {
                constructor: {
                    value: e,
                    enumerable: !1,
                    writable: !0,
                    configurable: !0
                }
            }), t && (Object.setPrototypeOf ? Object.setPrototypeOf(e, t) : e.__proto__ = t)
        }
        var o = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        };
        t.a = {
            name: "picture-input",
            props: {
                width: {
                    type: [String, Number],
                    default: Number.MAX_SAFE_INTEGER
                },
                height: {
                    type: [String, Number],
                    default: Number.MAX_SAFE_INTEGER
                },
                margin: {
                    type: [String, Number],
                    default: 0
                },
                accept: {
                    type: String,
                    default: "image/*"
                },
                size: {
                    type: [String, Number],
                    default: Number.MAX_SAFE_INTEGER
                },
                name: {
                    type: String,
                    default: null
                },
                id: {
                    type: [String, Number],
                    default: null
                },
                buttonClass: {
                    type: String,
                    default: "btn btn-primary button"
                },
                removeButtonClass: {
                    type: String,
                    default: "btn btn-secondary button secondary"
                },
                aspectButtonClass: {
                    type: String,
                    default: "btn btn-secondary button secondary"
                },
                prefill: {
                    type: [String, File],
                    default: ""
                },
                prefillOptions: {
                    type: Object,
                    default: function() {
                        return {}
                    }
                },
                crop: {
                    type: Boolean,
                    default: !0
                },
                radius: {
                    type: [String, Number],
                    default: 0
                },
                removable: {
                    type: Boolean,
                    default: !1
                },
                hideChangeButton: {
                    type: Boolean,
                    default: !1
                },
                autoToggleAspectRatio: {
                    type: Boolean,
                    default: !1
                },
                toggleAspectRatio: {
                    type: Boolean,
                    default: !1
                },
                changeOnClick: {
                    type: Boolean,
                    default: !0
                },
                plain: {
                    type: Boolean,
                    default: !1
                },
                zIndex: {
                    type: Number,
                    default: 1e4
                },
                alertOnError: {
                    type: Boolean,
                    default: !0
                },
                customStrings: {
                    type: Object,
                    default: function() {
                        return {}
                    }
                }
            },
            watch: {
                prefill: function() {
                    this.prefill ? this.preloadImage(this.prefill, this.prefillOptions) : this.removeImage()
                }
            },
            data: function() {
                return {
                    imageSelected: !1,
                    previewHeight: 0,
                    previewWidth: 0,
                    draggingOver: !1,
                    canvasWidth: 0,
                    canvasHeight: 0,
                    strings: {
                        upload: "<p>Your device does not support file uploading.</p>",
                        drag: "Drag an image or <br>click here to select a file",
                        tap: "Tap here to select a photo <br>from your gallery",
                        change: "Change Photo",
                        aspect: "Landscape/Portrait",
                        remove: "Remove Photo",
                        select: "Select a Photo",
                        selected: "<p>Photo successfully selected!</p>",
                        fileSize: "The file size exceeds the limit",
                        fileType: "This file type is not supported."
                    }
                }
            },
            mounted: function() {
                var e = this;
                if (this.updateStrings(), this.prefill && this.preloadImage(this.prefill, this.prefillOptions), this.$nextTick(function() {
                        window.addEventListener("resize", e.onResize), e.onResize()
                    }), this.supportsPreview) {
                    this.pixelRatio = Math.round(window.devicePixelRatio || window.screen.deviceXDPI / window.screen.logicalXDPI);
                    var t = this.$refs.previewCanvas;
                    t.getContext && (this.context = t.getContext("2d"), this.context.scale(this.pixelRatio, this.pixelRatio))
                }
                "image/*" !== this.accept && (this.fileTypes = this.accept.split(","), this.fileTypes = this.fileTypes.map(function(e) {
                    return e.trim()
                })), this.canvasWidth = this.width, this.canvasHeight = this.height, this.$on("error", this.onError)
            },
            beforeDestroy: function() {
                window.removeEventListener("resize", this.onResize), this.$off("error", this.onError)
            },
            methods: {
                updateStrings: function() {
                    for (var e in this.customStrings) e in this.strings && "string" == typeof this.customStrings[e] && (this.strings[e] = this.customStrings[e])
                },
                onClick: function() {
                    if (!this.imageSelected) return void this.selectImage();
                    this.changeOnClick && this.selectImage(), this.$emit("click")
                },
                onResize: function() {
                    this.resizeCanvas(), this.imageObject && this.drawImage(this.imageObject)
                },
                onDragEnter: function() {
                    this.supportsDragAndDrop && (this.draggingOver = !0)
                },
                onDragLeave: function() {
                    this.supportsDragAndDrop && (this.draggingOver = !1)
                },
                onFileDrop: function(e) {
                    this.onDragLeave(), this.onFileChange(e)
                },
                onFileChange: function(e, t) {
                    var i = e.target.files || e.dataTransfer.files;
                    if (i.length) {
                        if (i[0].size <= 0 || i[0].size > 1024 * this.size * 1024) return void this.$emit("error", {
                            type: "fileSize",
                            fileSize: i[0].size,
                            fileType: i[0].type,
                            fileName: i[0].name,
                            message: this.strings.fileSize + " (" + this.size + "MB)"
                        });
                        if (i[0].name !== this.fileName || i[0].size !== this.fileSize || this.fileModified !== i[0].lastModified) {
                            if (this.file = i[0], this.fileName = i[0].name, this.fileSize = i[0].size, this.fileModified = i[0].lastModified, this.fileType = i[0].type, "image/*" === this.accept) {
                                if ("image/" !== i[0].type.substr(0, 6)) return
                            } else if (-1 === this.fileTypes.indexOf(i[0].type)) return void this.$emit("error", {
                                type: "fileType",
                                fileSize: i[0].size,
                                fileType: i[0].type,
                                fileName: i[0].name,
                                message: this.strings.fileType
                            });
                            this.imageSelected = !0, this.image = "", this.supportsPreview ? this.loadImage(i[0], t || !1) : t ? this.$emit("prefill") : this.$emit("change", this.image)
                        }
                    }
                },
                onError: function(e) {
                    this.alertOnError && alert(e.message)
                },
                loadImage: function(e, t) {
                    var i = this;
                    this.getEXIFOrientation(e, function(n) {
                        i.setOrientation(n);
                        var r = new FileReader;
                        r.onload = function(e) {
                            i.image = e.target.result, t ? i.$emit("prefill") : i.$emit("change", i.image), i.imageObject = new Image, i.imageObject.onload = function() {
                                if (i.autoToggleAspectRatio) {
                                    i.getOrientation(i.canvasWidth, i.canvasHeight) !== i.getOrientation(i.imageObject.width, i.imageObject.height) && i.rotateCanvas()
                                }
                                i.drawImage(i.imageObject)
                            }, i.imageObject.src = i.image
                        }, r.readAsDataURL(e)
                    })
                },
                drawImage: function(e) {
                    this.imageWidth = e.width, this.imageHeight = e.height, this.imageRatio = e.width / e.height;
                    var t = 0,
                        i = 0,
                        n = this.previewWidth,
                        r = this.previewHeight,
                        a = this.previewWidth / this.previewHeight;
                    this.crop ? this.imageRatio >= a ? (n = r * this.imageRatio, t = (this.previewWidth - n) / 2) : (r = n / this.imageRatio, i = (this.previewHeight - r) / 2) : this.imageRatio >= a ? (r = n / this.imageRatio, i = (this.previewHeight - r) / 2) : (n = r * this.imageRatio, t = (this.previewWidth - n) / 2);
                    var o = this.$refs.previewCanvas;
                    o.style.background = "none", o.width = this.previewWidth * this.pixelRatio, o.height = this.previewHeight * this.pixelRatio, this.context.setTransform(1, 0, 0, 1, 0, 0), this.context.clearRect(0, 0, o.width, o.height), this.rotate && (this.context.translate(t * this.pixelRatio, i * this.pixelRatio), this.context.translate(n / 2 * this.pixelRatio, r / 2 * this.pixelRatio), this.context.rotate(this.rotate), t = -n / 2, i = -r / 2), this.context.drawImage(e, t * this.pixelRatio, i * this.pixelRatio, n * this.pixelRatio, r * this.pixelRatio)
                },
                selectImage: function() {
                    this.$refs.fileInput.click()
                },
                removeImage: function() {
                    this.$refs.fileInput.value = "", this.$refs.fileInput.type = "", this.$refs.fileInput.type = "file", this.fileName = "", this.fileType = "", this.fileSize = 0, this.fileModified = 0, this.imageSelected = !1, this.image = "", this.file = null, this.imageObject = null, this.$refs.previewCanvas.style.backgroundColor = "rgba(200,200,200,.25)", this.$refs.previewCanvas.width = this.previewWidth * this.pixelRatio, this.$emit("remove")
                },
                rotateImage: function() {
                    this.rotateCanvas(), this.imageObject && this.drawImage(this.imageObject);
                    var e = this.getOrientation(this.canvasWidth, this.canvasHeight);
                    this.$emit("aspectratiochange", e)
                },
                resizeCanvas: function() {
                    var e = this.canvasWidth / this.canvasHeight,
                        t = this.$refs.container.clientWidth;
                    (this.toggleAspectRatio || t !== this.containerWidth) && (this.containerWidth = t, this.previewWidth = Math.min(this.containerWidth - 2 * this.margin, this.canvasWidth), this.previewHeight = this.previewWidth / e)
                },
                getOrientation: function(e, t) {
                    var i = "square";
                    return e > t ? i = "landscape" : e < t && (i = "portrait"), i
                },
                switchCanvasOrientation: function() {
                    var e = this.canvasWidth,
                        t = this.canvasHeight;
                    this.canvasWidth = t, this.canvasHeight = e
                },
                rotateCanvas: function() {
                    this.switchCanvasOrientation(), this.resizeCanvas()
                },
                setOrientation: function(e) {
                    this.rotate = !1, 8 === e ? this.rotate = -Math.PI / 2 : 6 === e ? this.rotate = Math.PI / 2 : 3 === e && (this.rotate = -Math.PI)
                },
                getEXIFOrientation: function(e, t) {
                    var i = new FileReader;
                    i.onload = function(e) {
                        var i = new DataView(e.target.result);
                        if (65496 !== i.getUint16(0, !1)) return t(-2);
                        for (var n = i.byteLength, r = 2; r < n;) {
                            var a = i.getUint16(r, !1);
                            if (r += 2, 65505 === a) {
                                if (1165519206 !== i.getUint32(r += 2, !1)) return t(-1);
                                var o = 18761 === i.getUint16(r += 6, !1);
                                r += i.getUint32(r + 4, o);
                                var s = i.getUint16(r, o);
                                r += 2;
                                for (var l = 0; l < s; l++)
                                    if (274 === i.getUint16(r + 12 * l, o)) return t(i.getUint16(r + 12 * l + 8, o))
                            } else {
                                if (65280 != (65280 & a)) break;
                                r += i.getUint16(r, !1)
                            }
                        }
                        return t(-1)
                    }, i.readAsArrayBuffer(e.slice(0, 65536))
                },
                preloadImage: function(e, t) {
                    var i = this,
                        s = window.File;
                    try {
                        new s([], "")
                    } catch (e) {
                        s = function(e) {
                            function t(e, i) {
                                var a = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
                                n(this, t);
                                var o = r(this, (t.__proto__ || Object.getPrototypeOf(t)).call(this, e, a));
                                return o.lastModifiedDate = new Date, o.lastModified = +o.lastModifiedDate, o.name = i, o
                            }
                            return a(t, e), t
                        }(Blob)
                    }
                    if (t = Object.assign({}, t), "object" === (void 0 === e ? "undefined" : o(e))) return this.imageSelected = !0, this.image = "", void(this.supportsPreview ? this.loadImage(e, !0) : this.$emit("prefill"));
                    var l = new Headers;
                    l.append("Accept", "image/*"), fetch(e, {
                        method: "GET",
                        mode: "cors",
                        headers: l
                    }).then(function(e) {
                        return e.blob()
                    }).then(function(n) {
                        var r = {
                                target: {
                                    files: []
                                }
                            },
                            a = t.fileName || e.split("/").slice(-1)[0],
                            o = t.mediaType || "image/" + (t.fileType || a.split(".").slice(-1)[0]);
                        o = o.replace("jpg", "jpeg"), r.target.files[0] = new s([n], a, {
                            type: o
                        }), i.onFileChange(r, !0)
                    }).catch(function(e) {
                        i.$emit("error", {
                            type: "failedPrefill",
                            message: "Failed loading prefill image: " + e
                        })
                    })
                }
            },
            computed: {
                supportsUpload: function() {
                    if (navigator.userAgent.match(/(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(Windows Phone (OS 7|8.0))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/)) return !1;
                    var e = document.createElement("input");
                    return e.type = "file", !e.disabled
                },
                supportsPreview: function() {
                    return window.FileReader && !!window.CanvasRenderingContext2D
                },
                supportsDragAndDrop: function() {
                    var e = document.createElement("div");
                    return ("draggable" in e || "ondragstart" in e && "ondrop" in e) && !("ontouchstart" in window || navigator.msMaxTouchPoints)
                },
                computedClasses: function() {
                    var e = {};
                    return e["dragging-over"] = this.draggingOver, e
                },
                fontSize: function() {
                    return Math.min(.04 * this.previewWidth, 21) + "px"
                }
            }
        }
    }, function(e, t, i) {
        e.exports = i(2)
    }, function(e, t, i) {
        "use strict";

        function n(e) {
            i(3)
        }
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        var r = i(0),
            a = i(9),
            o = i(8),
            s = n,
            l = o(r.a, a.a, !1, s, "data-v-9a9e1848", null);
        t.default = l.exports
    }, function(e, t, i) {
        var n = i(4);
        "string" == typeof n && (n = [
            [e.i, n, ""]
        ]), n.locals && (e.exports = n.locals);
        i(6)("ec61b4de", n, !0, {
            sourceMap: !1
        })
    }, function(e, t, i) {
        t = e.exports = i(5)(!1), t.push([e.i, ".picture-input[data-v-9a9e1848]{width:100%;margin:0 auto;text-align:center}.preview-container[data-v-9a9e1848]{width:100%;-webkit-box-sizing:border-box;box-sizing:border-box;margin:0 auto;cursor:pointer;overflow:hidden}.picture-preview[data-v-9a9e1848]{width:100%;height:100%;position:relative;z-index:10001;-webkit-box-sizing:border-box;box-sizing:border-box;background-color:hsla(0,0%,78%,.25)}.picture-preview.dragging-over[data-v-9a9e1848]{-webkit-filter:brightness(.5);filter:brightness(.5)}.picture-inner[data-v-9a9e1848]{position:relative;z-index:10002;pointer-events:none;-webkit-box-sizing:border-box;box-sizing:border-box;margin:1em auto;padding:.5em;border:.3em dashed rgba(66,66,66,.15);border-radius:8px;width:calc(100% - 2.5em);height:calc(100% - 2.5em);display:table}.picture-inner .picture-inner-text[data-v-9a9e1848]{display:table-cell;vertical-align:middle;text-align:center;font-size:2em;line-height:1.5}button[data-v-9a9e1848]{margin:1em .25em;cursor:pointer}input[type=file][data-v-9a9e1848]{display:none}", ""])
    }, function(e, t) {
        function i(e, t) {
            var i = e[1] || "",
                r = e[3];
            if (!r) return i;
            if (t && "function" == typeof btoa) {
                var a = n(r);
                return [i].concat(r.sources.map(function(e) {
                    return "/*# sourceURL=" + r.sourceRoot + e + " */"
                })).concat([a]).join("\n")
            }
            return [i].join("\n")
        }

        function n(e) {
            return "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(e)))) + " */"
        }
        e.exports = function(e) {
            var t = [];
            return t.toString = function() {
                return this.map(function(t) {
                    var n = i(t, e);
                    return t[2] ? "@media " + t[2] + "{" + n + "}" : n
                }).join("")
            }, t.i = function(e, i) {
                "string" == typeof e && (e = [
                    [null, e, ""]
                ]);
                for (var n = {}, r = 0; r < this.length; r++) {
                    var a = this[r][0];
                    "number" == typeof a && (n[a] = !0)
                }
                for (r = 0; r < e.length; r++) {
                    var o = e[r];
                    "number" == typeof o[0] && n[o[0]] || (i && !o[2] ? o[2] = i : i && (o[2] = "(" + o[2] + ") and (" + i + ")"), t.push(o))
                }
            }, t
        }
    }, function(e, t, i) {
        function n(e) {
            for (var t = 0; t < e.length; t++) {
                var i = e[t],
                    n = u[i.id];
                if (n) {
                    n.refs++;
                    for (var r = 0; r < n.parts.length; r++) n.parts[r](i.parts[r]);
                    for (; r < i.parts.length; r++) n.parts.push(a(i.parts[r]));
                    n.parts.length > i.parts.length && (n.parts.length = i.parts.length)
                } else {
                    for (var o = [], r = 0; r < i.parts.length; r++) o.push(a(i.parts[r]));
                    u[i.id] = {
                        id: i.id,
                        refs: 1,
                        parts: o
                    }
                }
            }
        }

        function r() {
            var e = document.createElement("style");
            return e.type = "text/css", p.appendChild(e), e
        }

        function a(e) {
            var t, i, n = document.querySelector("style[" + m + '~="' + e.id + '"]');
            if (n) {
                if (f) return g;
                n.parentNode.removeChild(n)
            }
            if (b) {
                var a = d++;
                n = h || (h = r()), t = o.bind(null, n, a, !1), i = o.bind(null, n, a, !0)
            } else n = r(), t = s.bind(null, n), i = function() {
                n.parentNode.removeChild(n)
            };
            return t(e),
                function(n) {
                    if (n) {
                        if (n.css === e.css && n.media === e.media && n.sourceMap === e.sourceMap) return;
                        t(e = n)
                    } else i()
                }
        }

        function o(e, t, i, n) {
            var r = i ? "" : n.css;
            if (e.styleSheet) e.styleSheet.cssText = y(t, r);
            else {
                var a = document.createTextNode(r),
                    o = e.childNodes;
                o[t] && e.removeChild(o[t]), o.length ? e.insertBefore(a, o[t]) : e.appendChild(a)
            }
        }

        function s(e, t) {
            var i = t.css,
                n = t.media,
                r = t.sourceMap;
            if (n && e.setAttribute("media", n), v.ssrId && e.setAttribute(m, t.id), r && (i += "\n/*# sourceURL=" + r.sources[0] + " */", i += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(r)))) + " */"), e.styleSheet) e.styleSheet.cssText = i;
            else {
                for (; e.firstChild;) e.removeChild(e.firstChild);
                e.appendChild(document.createTextNode(i))
            }
        }
        var l = "undefined" != typeof document;
        if ("undefined" != typeof DEBUG && DEBUG && !l) throw new Error("vue-style-loader cannot be used in a non-browser environment. Use { target: 'node' } in your Webpack config to indicate a server-rendering environment.");
        var c = i(7),
            u = {},
            p = l && (document.head || document.getElementsByTagName("head")[0]),
            h = null,
            d = 0,
            f = !1,
            g = function() {},
            v = null,
            m = "data-vue-ssr-id",
            b = "undefined" != typeof navigator && /msie [6-9]\b/.test(navigator.userAgent.toLowerCase());
        e.exports = function(e, t, i, r) {
            f = i, v = r || {};
            var a = c(e, t);
            return n(a),
                function(t) {
                    for (var i = [], r = 0; r < a.length; r++) {
                        var o = a[r],
                            s = u[o.id];
                        s.refs--, i.push(s)
                    }
                    t ? (a = c(e, t), n(a)) : a = [];
                    for (var r = 0; r < i.length; r++) {
                        var s = i[r];
                        if (0 === s.refs) {
                            for (var l = 0; l < s.parts.length; l++) s.parts[l]();
                            delete u[s.id]
                        }
                    }
                }
        };
        var y = function() {
            var e = [];
            return function(t, i) {
                return e[t] = i, e.filter(Boolean).join("\n")
            }
        }()
    }, function(e, t) {
        e.exports = function(e, t) {
            for (var i = [], n = {}, r = 0; r < t.length; r++) {
                var a = t[r],
                    o = a[0],
                    s = a[1],
                    l = a[2],
                    c = a[3],
                    u = {
                        id: e + ":" + r,
                        css: s,
                        media: l,
                        sourceMap: c
                    };
                n[o] ? n[o].parts.push(u) : i.push(n[o] = {
                    id: o,
                    parts: [u]
                })
            }
            return i
        }
    }, function(e, t) {
        e.exports = function(e, t, i, n, r, a) {
            var o, s = e = e || {},
                l = typeof e.default;
            "object" !== l && "function" !== l || (o = e, s = e.default);
            var c = "function" == typeof s ? s.options : s;
            t && (c.render = t.render, c.staticRenderFns = t.staticRenderFns, c._compiled = !0), i && (c.functional = !0), r && (c._scopeId = r);
            var u;
            if (a ? (u = function(e) {
                    e = e || this.$vnode && this.$vnode.ssrContext || this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext, e || "undefined" == typeof __VUE_SSR_CONTEXT__ || (e = __VUE_SSR_CONTEXT__), n && n.call(this, e), e && e._registeredComponents && e._registeredComponents.add(a)
                }, c._ssrRegister = u) : n && (u = n), u) {
                var p = c.functional,
                    h = p ? c.render : c.beforeCreate;
                p ? (c._injectStyles = u, c.render = function(e, t) {
                    return u.call(t), h(e, t)
                }) : c.beforeCreate = h ? [].concat(h, u) : [u]
            }
            return {
                esModule: o,
                exports: s,
                options: c
            }
        }
    }, function(e, t, i) {
        "use strict";
        var n = function() {
                var e = this,
                    t = e.$createElement,
                    i = e._self._c || t;
                return i("div", {
                    ref: "container",
                    staticClass: "picture-input",
                    attrs: {
                        id: "picture-input"
                    }
                }, [e.supportsUpload ? e.supportsPreview ? i("div", [i("div", {
                    staticClass: "preview-container",
                    style: {
                        maxWidth: e.previewWidth + "px",
                        height: e.previewHeight + "px",
                        borderRadius: e.radius + "%"
                    }
                }, [i("canvas", {
                    ref: "previewCanvas",
                    staticClass: "picture-preview",
                    class: e.computedClasses,
                    style: {
                        height: e.previewHeight + "px",
                        zIndex: e.zIndex + 1
                    },
                    attrs: {
                        tabindex: "0"
                    },
                    on: {
                        drag: function(e) {
                            e.stopPropagation(), e.preventDefault()
                        },
                        dragover: function(e) {
                            e.stopPropagation(), e.preventDefault()
                        },
                        dragstart: function(e) {
                            e.stopPropagation(), e.preventDefault()
                        },
                        dragend: function(e) {
                            e.stopPropagation(), e.preventDefault()
                        },
                        dragenter: function(t) {
                            return t.stopPropagation(), t.preventDefault(), e.onDragEnter(t)
                        },
                        dragleave: function(t) {
                            return t.stopPropagation(), t.preventDefault(), e.onDragLeave(t)
                        },
                        drop: function(t) {
                            return t.stopPropagation(), t.preventDefault(), e.onFileDrop(t)
                        },
                        click: function(t) {
                            return t.preventDefault(), e.onClick(t)
                        },
                        keyup: function(t) {
                            return !t.type.indexOf("key") && e._k(t.keyCode, "enter", 13, t.key, "Enter") ? null : e.onClick(t)
                        }
                    }
                }), e._v(" "), e.imageSelected || e.plain ? e._e() : i("div", {
                    staticClass: "picture-inner",
                    style: {
                        top: -e.previewHeight + "px",
                        marginBottom: -e.previewHeight + "px",
                        fontSize: e.fontSize,
                        borderRadius: e.radius + "%",
                        zIndex: e.zIndex + 2
                    }
                }, [e.supportsDragAndDrop ? i("span", {
                    staticClass: "picture-inner-text",
                    domProps: {
                        innerHTML: e._s(e.strings.drag)
                    }
                }) : i("span", {
                    staticClass: "picture-inner-text",
                    domProps: {
                        innerHTML: e._s(e.strings.tap)
                    }
                })])]), e._v(" "), e.imageSelected && !e.hideChangeButton ? i("button", {
                    class: e.buttonClass,
                    on: {
                        click: function(t) {
                            return t.preventDefault(), e.selectImage(t)
                        }
                    }
                }, [e._v(e._s(e.strings.change))]) : e._e(), e._v(" "), e.imageSelected && e.removable ? i("button", {
                    class: e.removeButtonClass,
                    on: {
                        click: function(t) {
                            return t.preventDefault(), e.removeImage(t)
                        }
                    }
                }, [e._v(e._s(e.strings.remove))]) : e._e(), e._v(" "), e.imageSelected && e.toggleAspectRatio && e.width !== e.height ? i("button", {
                    class: e.aspectButtonClass,
                    on: {
                        click: function(t) {
                            return t.preventDefault(), e.rotateImage(t)
                        }
                    }
                }, [e._v(e._s(e.strings.aspect))]) : e._e()]) : i("div", [e.imageSelected ? i("div", [i("div", {
                    domProps: {
                        innerHTML: e._s(e.strings.selected)
                    }
                }), e._v(" "), e.hideChangeButton ? e._e() : i("button", {
                    class: e.buttonClass,
                    on: {
                        click: function(t) {
                            return t.preventDefault(), e.selectImage(t)
                        }
                    }
                }, [e._v(e._s(e.strings.change))]), e._v(" "), e.removable ? i("button", {
                    class: e.removeButtonClass,
                    on: {
                        click: function(t) {
                            return t.preventDefault(), e.removeImage(t)
                        }
                    }
                }, [e._v(e._s(e.strings.remove))]) : e._e()]) : i("button", {
                    class: e.buttonClass,
                    on: {
                        click: function(t) {
                            return t.preventDefault(), e.selectImage(t)
                        }
                    }
                }, [e._v(e._s(e.strings.select))])]) : i("div", {
                    domProps: {
                        innerHTML: e._s(e.strings.upload)
                    }
                }), e._v(" "), i("input", {
                    ref: "fileInput",
                    attrs: {
                        type: "file",
                        name: e.name,
                        id: e.id,
                        accept: e.accept
                    },
                    on: {
                        change: e.onFileChange
                    }
                })])
            },
            r = [],
            a = {
                render: n,
                staticRenderFns: r
            };
        t.a = a
    }])
});
