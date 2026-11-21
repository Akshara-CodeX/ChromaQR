/**
 * QR Code Generator (Pure Vanilla JavaScript)
 * ISO/IEC 18004 compliant QR Code model & Reed-Solomon encoder
 * Zero external dependencies. Self-contained & works completely offline.
 */
const QrEngine = (function() {
    "use strict";

    class QrCode {
        constructor(version, errorCorrectionLevel, dataCodewords, msk) {
            if (version < QrCode.MIN_VERSION || version > QrCode.MAX_VERSION) {
                throw new RangeError("Version value out of range (1-40)");
            }
            if (msk < -1 || msk > 7) {
                throw new RangeError("Mask value out of range (-1 to 7)");
            }
            this.version = version;
            this.size = version * 4 + 17;
            this.errorCorrectionLevel = errorCorrectionLevel;

            this.modules = [];
            this.isFunction = [];
            for (let y = 0; y < this.size; y++) {
                this.modules.push(new Array(this.size).fill(false));
                this.isFunction.push(new Array(this.size).fill(false));
            }

            this._drawFunctionPatterns();
            const allCodewords = this._addEccAndInterleave(dataCodewords);
            this._drawCodewords(allCodewords);

            // Auto-select optimal mask if -1 is passed
            if (msk === -1) {
                let minPenalty = 1e9;
                let bestMask = 0;
                for (let i = 0; i < 8; i++) {
                    this._applyMask(i);
                    this._drawFormatBits(i);
                    const penalty = this._getPenaltyScore();
                    if (penalty < minPenalty) {
                        minPenalty = penalty;
                        bestMask = i;
                    }
                    this._applyMask(i); // revert
                }
                msk = bestMask;
            }
            this.mask = msk;
            this._applyMask(msk);
            this._drawFormatBits(msk);
            this.isFunction = []; // free memory
        }

        getModule(x, y) {
            return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
        }

        _drawFunctionPatterns() {
            const size = this.size;
            // Timing patterns
            for (let i = 0; i < size; i++) {
                this._setFunctionModule(6, i, i % 2 === 0);
                this._setFunctionModule(i, 6, i % 2 === 0);
            }
            // Finder patterns
            this._drawFinderPattern(3, 3);
            this._drawFinderPattern(size - 4, 3);
            this._drawFinderPattern(3, size - 4);

            // Alignment patterns
            const alignPatPos = QrCode._getAlignmentPatternPositions(this.version);
            const numAlign = alignPatPos.length;
            for (let i = 0; i < numAlign; i++) {
                for (let j = 0; j < numAlign; j++) {
                    if ((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0))
                        continue;
                    this._drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
                }
            }

            this._drawFormatBits(0);
            this._drawVersion();
        }

        _drawFormatBits(mask) {
            const data = (this.errorCorrectionLevel.formatBits << 3) | mask;
            let rem = data;
            for (let i = 0; i < 10; i++) {
                rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
            }
            const bits = ((data << 10) | rem) ^ 0x5412;

            for (let i = 0; i <= 5; i++)
                this._setFunctionModule(8, i, ((bits >>> i) & 1) !== 0);
            this._setFunctionModule(8, 7, ((bits >>> 6) & 1) !== 0);
            this._setFunctionModule(8, 8, ((bits >>> 7) & 1) !== 0);
            this._setFunctionModule(7, 8, ((bits >>> 8) & 1) !== 0);
            for (let i = 9; i < 15; i++)
                this._setFunctionModule(14 - i, 8, ((bits >>> i) & 1) !== 0);

            const size = this.size;
            for (let i = 0; i < 8; i++)
                this._setFunctionModule(size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
            for (let i = 8; i < 15; i++)
                this._setFunctionModule(8, size - 15 + i, ((bits >>> i) & 1) !== 0);
            this._setFunctionModule(8, size - 8, true);
        }

        _drawVersion() {
            if (this.version < 7) return;
            let rem = this.version;
            for (let i = 0; i < 12; i++) {
                rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
            }
            const bits = (this.version << 12) | rem;
            for (let i = 0; i < 18; i++) {
                const bit = ((bits >>> i) & 1) !== 0;
                const a = this.size - 11 + (i % 3);
                const b = Math.floor(i / 3);
                this._setFunctionModule(a, b, bit);
                this._setFunctionModule(b, a, bit);
            }
        }

        _drawFinderPattern(x, y) {
            for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    const dist = Math.max(Math.abs(dx), Math.abs(dy));
                    const qx = x + dx;
                    const qy = y + dy;
                    if (qx >= 0 && qx < this.size && qy >= 0 && qy < this.size) {
                        this._setFunctionModule(qx, qy, dist !== 2 && dist !== 4);
                    }
                }
            }
        }

        _drawAlignmentPattern(x, y) {
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    this._setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
                }
            }
        }

        _setFunctionModule(x, y, isDark) {
            this.modules[y][x] = isDark;
            this.isFunction[y][x] = true;
        }

        _addEccAndInterleave(data) {
            const ver = this.version;
            const ecl = this.errorCorrectionLevel;
            const numBlocks = QrCode._NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
            const blockEccLen = QrCode._ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
            const rawCodewords = QrCode._getNumRawDataModules(ver) / 8;
            const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
            const shortBlockLen = Math.floor(rawCodewords / numBlocks);

            const blocks = [];
            const rsDiv = QrCode._reedSolomonComputeDivisor(blockEccLen);
            for (let i = 0, k = 0; i < numBlocks; i++) {
                const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i >= numShortBlocks ? 1 : 0));
                k += dat.length;
                const ecc = QrCode._reedSolomonComputeRemainder(dat, rsDiv);
                blocks.push({ data: dat, ecc: ecc });
            }

            const result = [];
            for (let i = 0; i < shortBlockLen - blockEccLen + 1; i++) {
                for (let j = 0; j < numBlocks; j++) {
                    if (i < blocks[j].data.length) {
                        result.push(blocks[j].data[i]);
                    }
                }
            }
            for (let i = 0; i < blockEccLen; i++) {
                for (let j = 0; j < numBlocks; j++) {
                    result.push(blocks[j].ecc[i]);
                }
            }
            return result;
        }

        _drawCodewords(data) {
            let i = 0;
            const size = this.size;
            for (let right = size - 1; right >= 1; right -= 2) {
                if (right === 6) right = 5;
                for (let vert = 0; vert < size; vert++) {
                    for (let j = 0; j < 2; j++) {
                        const x = right - j;
                        const upward = ((right + 1) & 2) === 0;
                        const y = upward ? size - 1 - vert : vert;
                        if (!this.isFunction[y][x] && i < data.length * 8) {
                            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
                            i++;
                        }
                    }
                }
            }
        }

        _applyMask(mask) {
            for (let y = 0; y < this.size; y++) {
                for (let x = 0; x < this.size; x++) {
                    if (this.isFunction[y][x]) continue;
                    let invert = false;
                    switch (mask) {
                        case 0: invert = (x + y) % 2 === 0; break;
                        case 1: invert = y % 2 === 0; break;
                        case 2: invert = x % 3 === 0; break;
                        case 3: invert = (x + y) % 3 === 0; break;
                        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                        case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
                        case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
                        case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
                    }
                    if (invert) this.modules[y][x] = !this.modules[y][x];
                }
            }
        }

        _getPenaltyScore() {
            let penalty = 0;
            const size = this.size;
            // Rule 1: 5+ consecutive same color
            for (let y = 0; y < size; y++) {
                let runColor = false, runVal = 0;
                for (let x = 0; x < size; x++) {
                    if (x === 0 || this.modules[y][x] !== runColor) {
                        runColor = this.modules[y][x];
                        runVal = 1;
                    } else {
                        runVal++;
                        if (runVal === 5) penalty += 3;
                        else if (runVal > 5) penalty++;
                    }
                }
            }
            for (let x = 0; x < size; x++) {
                let runColor = false, runVal = 0;
                for (let y = 0; y < size; y++) {
                    if (y === 0 || this.modules[y][x] !== runColor) {
                        runColor = this.modules[y][x];
                        runVal = 1;
                    } else {
                        runVal++;
                        if (runVal === 5) penalty += 3;
                        else if (runVal > 5) penalty++;
                    }
                }
            }
            // Rule 2: 2x2 blocks
            for (let y = 0; y < size - 1; y++) {
                for (let x = 0; x < size - 1; x++) {
                    const c = this.modules[y][x];
                    if (c === this.modules[y][x+1] && c === this.modules[y+1][x] && c === this.modules[y+1][x+1])
                        penalty += 3;
                }
            }
            // Rule 4: Balance of dark/light modules
            let totalDark = 0;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (this.modules[y][x]) totalDark++;
                }
            }
            const totalModules = size * size;
            const k = Math.ceil(Math.abs(totalDark * 20 - totalModules * 10) / totalModules) - 1;
            penalty += k * 10;
            return penalty;
        }

        static encodeText(text, ecl) {
            ecl = ecl || QrCode.Ecc.HIGH; // High ECC default for artistic/image QR
            const segs = QrSegment.makeSegments(text);
            return QrCode.encodeSegments(segs, ecl);
        }

        static encodeSegments(segs, ecl, minVer = 1, maxVer = 40, mask = -1) {
            for (let ver = minVer; ver <= maxVer; ver++) {
                const dataUsed = QrSegment.getTotalBits(segs, ver);
                const dataCap = QrCode._getNumDataCodewords(ver, ecl) * 8;
                if (dataUsed <= dataCap) {
                    const bb = [];
                    for (const seg of segs) {
                        bb.push(...seg.getData(ver));
                    }
                    for (let i = 0; i < 4 && bb.length < dataCap; i++) bb.push(0);
                    while (bb.length % 8 !== 0) bb.push(0);
                    for (let pad = 0xEC; bb.length < dataCap; pad ^= 0xEC ^ 0x11) {
                        for (let b = 7; b >= 0; b--) bb.push((pad >>> b) & 1);
                    }
                    const dataCodewords = [];
                    for (let i = 0; i < bb.length; i += 8) {
                        let byte = 0;
                        for (let j = 0; j < 8; j++) byte = (byte << 1) | bb[i + j];
                        dataCodewords.push(byte);
                    }
                    return new QrCode(ver, ecl, dataCodewords, mask);
                }
            }
            throw new Error("Content is too long to fit in a QR Code");
        }
    }

    QrCode.MIN_VERSION = 1;
    QrCode.MAX_VERSION = 40;

    class Ecc {
        constructor(ordinal, formatBits) {
            this.ordinal = ordinal;
            this.formatBits = formatBits;
        }
    }
    QrCode.Ecc = {
        LOW: new Ecc(0, 1),
        MEDIUM: new Ecc(1, 0),
        QUARTILE: new Ecc(2, 3),
        HIGH: new Ecc(3, 2),
    };

    class QrSegment {
        constructor(mode, numChars, bitData) {
            this.mode = mode;
            this.numChars = numChars;
            this.bitData = bitData;
        }
        static makeBytes(data) {
            const bb = [];
            for (const b of data) {
                for (let i = 7; i >= 0; i--) bb.push((b >>> i) & 1);
            }
            return new QrSegment(QrSegment.Mode.BYTE, data.length, bb);
        }
        static makeSegments(text) {
            const bytes = [];
            for (let i = 0; i < text.length; i++) {
                let c = text.charCodeAt(i);
                if (c < 0x80) bytes.push(c);
                else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
                else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
                else {
                    i++;
                    c = 0x10000 + (((c & 0x3ff) << 10) | (text.charCodeAt(i) & 0x3ff));
                    bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
                }
            }
            return [QrSegment.makeBytes(bytes)];
        }
        static getTotalBits(segs, version) {
            let total = 0;
            for (const seg of segs) {
                const ccbits = seg.mode.numCharCountBits(version);
                total += 4 + ccbits + seg.bitData.length;
            }
            return total;
        }
        getData(version) {
            const res = [];
            for (let i = 3; i >= 0; i--) res.push((this.mode.modeBits >>> i) & 1);
            const ccbits = this.mode.numCharCountBits(version);
            for (let i = ccbits - 1; i >= 0; i--) res.push((this.numChars >>> i) & 1);
            res.push(...this.bitData);
            return res;
        }
    }

    class Mode {
        constructor(modeBits, charCountBits) {
            this.modeBits = modeBits;
            this.charCountBits = charCountBits;
        }
        numCharCountBits(ver) {
            return this.charCountBits[Math.floor((ver + 7) / 17)];
        }
    }
    QrSegment.Mode = {
        NUMERIC: new Mode(0x1, [10, 12, 14]),
        ALPHANUMERIC: new Mode(0x2, [9, 11, 13]),
        BYTE: new Mode(0x4, [8, 16, 16]),
        KANJI: new Mode(0x8, [8, 10, 12]),
    };

    QrCode._ECC_CODEWORDS_PER_BLOCK = [
        [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
        [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    ];

    QrCode._NUM_ERROR_CORRECTION_BLOCKS = [
        [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
        [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
        [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
        [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 72, 74, 77],
    ];

    QrCode._getNumRawDataModules = function(ver) {
        let result = (16 * ver + 128) * ver + 64;
        if (ver >= 2) {
            const numAlign = Math.floor(ver / 7) + 2;
            result -= (25 * numAlign - 10) * numAlign - 55;
            if (ver >= 7) result -= 36;
        }
        return result;
    };

    QrCode._getNumDataCodewords = function(ver, ecl) {
        return Math.floor(QrCode._getNumRawDataModules(ver) / 8) -
            QrCode._ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
            QrCode._NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    };

    QrCode._getAlignmentPatternPositions = function(ver) {
        if (ver === 1) return [];
        const numAlign = Math.floor(ver / 7) + 2;
        const step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
        const result = [6];
        for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step)
            result.splice(1, 0, pos);
        return result;
    };

    QrCode._reedSolomonComputeDivisor = function(degree) {
        let result = [];
        for (let i = 0; i < degree - 1; i++) result.push(0);
        result.push(1);
        let root = 1;
        for (let i = 0; i < degree; i++) {
            for (let j = 0; j < result.length; j++) {
                result[j] = QrCode._reedSolomonMultiply(result[j], root);
                if (j + 1 < result.length) result[j] ^= result[j + 1];
            }
            root = QrCode._reedSolomonMultiply(root, 0x02);
        }
        return result;
    };

    QrCode._reedSolomonComputeRemainder = function(data, divisor) {
        const result = divisor.map(() => 0);
        for (const b of data) {
            const factor = b ^ result.shift();
            result.push(0);
            for (let i = 0; i < divisor.length; i++) {
                result[i] ^= QrCode._reedSolomonMultiply(divisor[i], factor);
            }
        }
        return result;
    };

    QrCode._reedSolomonMultiply = function(x, y) {
        let z = 0;
        for (let i = 7; i >= 0; i--) {
            z = (z << 1) ^ ((z >>> 7) * 0x11D);
            z ^= ((y >>> i) & 1) * x;
        }
        return z;
    };

    return {
        QrCode: QrCode,
        Ecc: QrCode.Ecc
    };
})();

// Export for node testing if module is defined
if (typeof module !== "undefined" && module.exports) {
    module.exports = QrEngine;
}
