"use strict"
let app

;(function(_app) {
  function initialize() {
    getElem("loading").style.display = "none"
    getElem("loaded").style.removeProperty("display")
    let elems = document.querySelectorAll(
      "input[type=number], input[type=text], textarea"
    )
    for (let el of elems) {
      if (el.id.indexOf("version-") != 0) el.oninput = redrawQrCode
    }
    elems = document.querySelectorAll("input[type=radio], input[type=checkbox]")
    for (let el of elems) el.onchange = redrawQrCode
    redrawQrCode()
  }

  function redrawQrCode() {
    const bitmapOutput = getInput("output-format-bitmap").checked
    const scaleRow = getElem("scale-row")
    let download = getElem("download")
    if (bitmapOutput) {
      scaleRow.style.removeProperty("display")
      download.download = "qr-code.png"
    } else {
      scaleRow.style.display = "none"
      download.download = "qr-code.svg"
    }
    download.removeAttribute("href")

    const canvas = getElem("qrcode-canvas")
    const svg = document.getElementById("qrcode-svg")
    canvas.style.display = "none"
    svg.style.display = "none"

    function getInputErrorCorrectionLevel() {
      if (getInput("errcorlvl-medium").checked)
        return qrcodegen.QrCode.Ecc.MEDIUM
      else if (getInput("errcorlvl-quartile").checked)
        return qrcodegen.QrCode.Ecc.QUARTILE
      else if (getInput("errcorlvl-high").checked)
        return qrcodegen.QrCode.Ecc.HIGH
      else return qrcodegen.QrCode.Ecc.LOW
    }

    const ecl = getInputErrorCorrectionLevel()
    const text = getElem("text-input").value
    const segs = qrcodegen.QrSegment.makeSegments(text)
    const minVer = parseInt(getInput("version-min-input").value, 10)
    const maxVer = parseInt(getInput("version-max-input").value, 10)
    const mask = parseInt(getInput("mask-input").value, 10)
    const boostEcc = getInput("boost-ecc-input").checked
    const qr = qrcodegen.QrCode.encodeSegments(
      segs,
      ecl,
      minVer,
      maxVer,
      mask,
      boostEcc
    )

    const border = parseInt(getInput("border-input").value, 10)
    const lightColor = getInput("light-color-input").value
    const darkColor = getInput("dark-color-input").value
    if (border < 0 || border > 100) return
    if (bitmapOutput) {
      const scale = parseInt(getInput("scale-input").value, 10)
      if (scale <= 0 || scale > 30) return
      drawCanvas(qr, scale, border, lightColor, darkColor, canvas)
      canvas.style.removeProperty("display")
      download.href = canvas.toDataURL("image/png")
    } else {
      const code = toSvgString(qr, border, lightColor, darkColor)
      const viewBox = / viewBox="([^"]*)"/.exec(code)[1]
      const pathD = / d="([^"]*)"/.exec(code)[1]
      svg.setAttribute("viewBox", viewBox)
      svg.querySelector("path").setAttribute("d", pathD)
      svg.querySelector("rect").setAttribute("fill", lightColor)
      svg.querySelector("path").setAttribute("fill", darkColor)
      svg.style.removeProperty("display")
      download.href = "data:application/svg+xml," + encodeURIComponent(code)
    }

    function describeSegments(segs) {
      if (segs.length == 0) return "none"
      else if (segs.length == 1) {
        const mode = segs[0].mode
        const Mode = qrcodegen.QrSegment.Mode
        if (mode == Mode.NUMERIC) return "numeric"
        if (mode == Mode.ALPHANUMERIC) return "alphanumeric"
        if (mode == Mode.BYTE) return "byte"
        if (mode == Mode.KANJI) return "kanji"
        return "unknown"
      } else return "multiple"
    }

    function countUnicodeChars(str) {
      let result = 0
      for (const ch of str) {
        const cc = ch.codePointAt(0)
        if (0xd800 <= cc && cc < 0xe000)
          throw new RangeError("Invalid UTF-16 string")
        result++
      }
      return result
    }

    getElem("statistics-output").textContent =
      `QR Code version = ${qr.version}, ` +
      `mask pattern = ${qr.mask}, ` +
      `character count = ${countUnicodeChars(text)},\n` +
      `encoding mode = ${describeSegments(segs)}, ` +
      `error correction = level ${"LMQH".charAt(
        qr.errorCorrectionLevel.ordinal
      )}, ` +
      `data bits = ${qrcodegen.QrSegment.getTotalBits(segs, qr.version)}.`
  }

  function drawCanvas(qr, scale, border, lightColor, darkColor, canvas) {
    if (scale <= 0 || border < 0) throw new RangeError("Value out of range")
    const width = (qr.size + border * 2) * scale
    canvas.width = width
    canvas.height = width
    let ctx = canvas.getContext("2d")
    for (let y = -border; y < qr.size + border; y++) {
      for (let x = -border; x < qr.size + border; x++) {
        ctx.fillStyle = qr.getModule(x, y) ? darkColor : lightColor
        ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale)
      }
    }
  }

  function toSvgString(qr, border, lightColor, darkColor) {
    if (border < 0) throw new RangeError("Border must be non-negative")
    let parts = []
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.getModule(x, y))
          parts.push(`M${x + border},${y + border}h1v1h-1z`)
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${qr.size +
      border * 2} ${qr.size + border * 2}" stroke="none">
    <rect width="100%" height="100%" fill="${lightColor}"/>
    <path d="${parts.join(" ")}" fill="${darkColor}"/>
</svg>
`
  }

  function handleVersionMinMax(which) {
    const minElem = getInput("version-min-input")
    const maxElem = getInput("version-max-input")
    let minVal = parseInt(minElem.value, 10)
    let maxVal = parseInt(maxElem.value, 10)
    minVal = Math.max(
      Math.min(minVal, qrcodegen.QrCode.MAX_VERSION),
      qrcodegen.QrCode.MIN_VERSION
    )
    maxVal = Math.max(
      Math.min(maxVal, qrcodegen.QrCode.MAX_VERSION),
      qrcodegen.QrCode.MIN_VERSION
    )
    if (which == "min" && minVal > maxVal) maxVal = minVal
    else if (which == "max" && maxVal < minVal) minVal = maxVal
    minElem.value = minVal.toString()
    maxElem.value = maxVal.toString()
    redrawQrCode()
  }

  _app.handleVersionMinMax = handleVersionMinMax

  function getElem(id) {
    const result = document.getElementById(id)
    if (result instanceof HTMLElement) return result
    throw new Error("Assertion error")
  }

  function getInput(id) {
    const result = getElem(id)
    if (result instanceof HTMLInputElement) return result
    throw new Error("Assertion error")
  }

  initialize()
})(app || (app = {}))
