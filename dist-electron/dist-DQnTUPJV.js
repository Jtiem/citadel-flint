const ze = /* @__PURE__ */ new Set([
  65534,
  65535,
  131070,
  131071,
  196606,
  196607,
  262142,
  262143,
  327678,
  327679,
  393214,
  393215,
  458750,
  458751,
  524286,
  524287,
  589822,
  589823,
  655358,
  655359,
  720894,
  720895,
  786430,
  786431,
  851966,
  851967,
  917502,
  917503,
  983038,
  983039,
  1048574,
  1048575,
  1114110,
  1114111
]), u = "�";
var r;
(function(e) {
  e[e.EOF = -1] = "EOF", e[e.NULL = 0] = "NULL", e[e.TABULATION = 9] = "TABULATION", e[e.CARRIAGE_RETURN = 13] = "CARRIAGE_RETURN", e[e.LINE_FEED = 10] = "LINE_FEED", e[e.FORM_FEED = 12] = "FORM_FEED", e[e.SPACE = 32] = "SPACE", e[e.EXCLAMATION_MARK = 33] = "EXCLAMATION_MARK", e[e.QUOTATION_MARK = 34] = "QUOTATION_MARK", e[e.AMPERSAND = 38] = "AMPERSAND", e[e.APOSTROPHE = 39] = "APOSTROPHE", e[e.HYPHEN_MINUS = 45] = "HYPHEN_MINUS", e[e.SOLIDUS = 47] = "SOLIDUS", e[e.DIGIT_0 = 48] = "DIGIT_0", e[e.DIGIT_9 = 57] = "DIGIT_9", e[e.SEMICOLON = 59] = "SEMICOLON", e[e.LESS_THAN_SIGN = 60] = "LESS_THAN_SIGN", e[e.EQUALS_SIGN = 61] = "EQUALS_SIGN", e[e.GREATER_THAN_SIGN = 62] = "GREATER_THAN_SIGN", e[e.QUESTION_MARK = 63] = "QUESTION_MARK", e[e.LATIN_CAPITAL_A = 65] = "LATIN_CAPITAL_A", e[e.LATIN_CAPITAL_Z = 90] = "LATIN_CAPITAL_Z", e[e.RIGHT_SQUARE_BRACKET = 93] = "RIGHT_SQUARE_BRACKET", e[e.GRAVE_ACCENT = 96] = "GRAVE_ACCENT", e[e.LATIN_SMALL_A = 97] = "LATIN_SMALL_A", e[e.LATIN_SMALL_Z = 122] = "LATIN_SMALL_Z";
})(r || (r = {}));
const O = {
  DASH_DASH: "--",
  CDATA_START: "[CDATA[",
  DOCTYPE: "doctype",
  SCRIPT: "script",
  PUBLIC: "public",
  SYSTEM: "system"
};
function Oe(e) {
  return e >= 55296 && e <= 57343;
}
function Je(e) {
  return e >= 56320 && e <= 57343;
}
function je(e, t) {
  return (e - 55296) * 1024 + 9216 + t;
}
function Se(e) {
  return e !== 32 && e !== 10 && e !== 13 && e !== 9 && e !== 12 && e >= 1 && e <= 31 || e >= 127 && e <= 159;
}
function Le(e) {
  return e >= 64976 && e <= 65007 || ze.has(e);
}
var E;
(function(e) {
  e.controlCharacterInInputStream = "control-character-in-input-stream", e.noncharacterInInputStream = "noncharacter-in-input-stream", e.surrogateInInputStream = "surrogate-in-input-stream", e.nonVoidHtmlElementStartTagWithTrailingSolidus = "non-void-html-element-start-tag-with-trailing-solidus", e.endTagWithAttributes = "end-tag-with-attributes", e.endTagWithTrailingSolidus = "end-tag-with-trailing-solidus", e.unexpectedSolidusInTag = "unexpected-solidus-in-tag", e.unexpectedNullCharacter = "unexpected-null-character", e.unexpectedQuestionMarkInsteadOfTagName = "unexpected-question-mark-instead-of-tag-name", e.invalidFirstCharacterOfTagName = "invalid-first-character-of-tag-name", e.unexpectedEqualsSignBeforeAttributeName = "unexpected-equals-sign-before-attribute-name", e.missingEndTagName = "missing-end-tag-name", e.unexpectedCharacterInAttributeName = "unexpected-character-in-attribute-name", e.unknownNamedCharacterReference = "unknown-named-character-reference", e.missingSemicolonAfterCharacterReference = "missing-semicolon-after-character-reference", e.unexpectedCharacterAfterDoctypeSystemIdentifier = "unexpected-character-after-doctype-system-identifier", e.unexpectedCharacterInUnquotedAttributeValue = "unexpected-character-in-unquoted-attribute-value", e.eofBeforeTagName = "eof-before-tag-name", e.eofInTag = "eof-in-tag", e.missingAttributeValue = "missing-attribute-value", e.missingWhitespaceBetweenAttributes = "missing-whitespace-between-attributes", e.missingWhitespaceAfterDoctypePublicKeyword = "missing-whitespace-after-doctype-public-keyword", e.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers = "missing-whitespace-between-doctype-public-and-system-identifiers", e.missingWhitespaceAfterDoctypeSystemKeyword = "missing-whitespace-after-doctype-system-keyword", e.missingQuoteBeforeDoctypePublicIdentifier = "missing-quote-before-doctype-public-identifier", e.missingQuoteBeforeDoctypeSystemIdentifier = "missing-quote-before-doctype-system-identifier", e.missingDoctypePublicIdentifier = "missing-doctype-public-identifier", e.missingDoctypeSystemIdentifier = "missing-doctype-system-identifier", e.abruptDoctypePublicIdentifier = "abrupt-doctype-public-identifier", e.abruptDoctypeSystemIdentifier = "abrupt-doctype-system-identifier", e.cdataInHtmlContent = "cdata-in-html-content", e.incorrectlyOpenedComment = "incorrectly-opened-comment", e.eofInScriptHtmlCommentLikeText = "eof-in-script-html-comment-like-text", e.eofInDoctype = "eof-in-doctype", e.nestedComment = "nested-comment", e.abruptClosingOfEmptyComment = "abrupt-closing-of-empty-comment", e.eofInComment = "eof-in-comment", e.incorrectlyClosedComment = "incorrectly-closed-comment", e.eofInCdata = "eof-in-cdata", e.absenceOfDigitsInNumericCharacterReference = "absence-of-digits-in-numeric-character-reference", e.nullCharacterReference = "null-character-reference", e.surrogateCharacterReference = "surrogate-character-reference", e.characterReferenceOutsideUnicodeRange = "character-reference-outside-unicode-range", e.controlCharacterReference = "control-character-reference", e.noncharacterCharacterReference = "noncharacter-character-reference", e.missingWhitespaceBeforeDoctypeName = "missing-whitespace-before-doctype-name", e.missingDoctypeName = "missing-doctype-name", e.invalidCharacterSequenceAfterDoctypeName = "invalid-character-sequence-after-doctype-name", e.duplicateAttribute = "duplicate-attribute", e.nonConformingDoctype = "non-conforming-doctype", e.missingDoctype = "missing-doctype", e.misplacedDoctype = "misplaced-doctype", e.endTagWithoutMatchingOpenElement = "end-tag-without-matching-open-element", e.closingOfElementWithOpenChildElements = "closing-of-element-with-open-child-elements", e.disallowedContentInNoscriptInHead = "disallowed-content-in-noscript-in-head", e.openElementsLeftAfterEof = "open-elements-left-after-eof", e.abandonedHeadElementChild = "abandoned-head-element-child", e.misplacedStartTagForHeadElement = "misplaced-start-tag-for-head-element", e.nestedNoscriptInHead = "nested-noscript-in-head", e.eofInElementThatCanContainOnlyText = "eof-in-element-that-can-contain-only-text";
})(E || (E = {}));
const Ze = 65536;
var $e = class {
  constructor(e) {
    this.handler = e, this.html = "", this.pos = -1, this.lastGapPos = -2, this.gapStack = [], this.skipNextNewLine = !1, this.lastChunkWritten = !1, this.endOfChunkHit = !1, this.bufferWaterline = Ze, this.isEol = !1, this.lineStartPos = 0, this.droppedBufferSize = 0, this.line = 1, this.lastErrOffset = -1;
  }
  /** The column on the current line. If we just saw a gap (eg. a surrogate pair), return the index before. */
  get col() {
    return this.pos - this.lineStartPos + +(this.lastGapPos !== this.pos);
  }
  get offset() {
    return this.droppedBufferSize + this.pos;
  }
  getError(e, t) {
    const { line: a, col: o, offset: T } = this, _ = o + t, m = T + t;
    return {
      code: e,
      startLine: a,
      endLine: a,
      startCol: _,
      endCol: _,
      startOffset: m,
      endOffset: m
    };
  }
  _err(e) {
    this.handler.onParseError && this.lastErrOffset !== this.offset && (this.lastErrOffset = this.offset, this.handler.onParseError(this.getError(e, 0)));
  }
  _addGap() {
    this.gapStack.push(this.lastGapPos), this.lastGapPos = this.pos;
  }
  _processSurrogate(e) {
    if (this.pos !== this.html.length - 1) {
      const t = this.html.charCodeAt(this.pos + 1);
      if (Je(t))
        return this.pos++, this._addGap(), je(e, t);
    } else if (!this.lastChunkWritten)
      return this.endOfChunkHit = !0, r.EOF;
    return this._err(E.surrogateInInputStream), e;
  }
  willDropParsedChunk() {
    return this.pos > this.bufferWaterline;
  }
  dropParsedChunk() {
    this.willDropParsedChunk() && (this.html = this.html.substring(this.pos), this.lineStartPos -= this.pos, this.droppedBufferSize += this.pos, this.pos = 0, this.lastGapPos = -2, this.gapStack.length = 0);
  }
  write(e, t) {
    this.html.length > 0 ? this.html += e : this.html = e, this.endOfChunkHit = !1, this.lastChunkWritten = t;
  }
  insertHtmlAtCurrentPos(e) {
    this.html = this.html.substring(0, this.pos + 1) + e + this.html.substring(this.pos + 1), this.endOfChunkHit = !1;
  }
  startsWith(e, t) {
    if (this.pos + e.length > this.html.length)
      return this.endOfChunkHit = !this.lastChunkWritten, !1;
    if (t) return this.html.startsWith(e, this.pos);
    for (let a = 0; a < e.length; a++) if ((this.html.charCodeAt(this.pos + a) | 32) !== e.charCodeAt(a)) return !1;
    return !0;
  }
  peek(e) {
    const t = this.pos + e;
    if (t >= this.html.length)
      return this.endOfChunkHit = !this.lastChunkWritten, r.EOF;
    const a = this.html.charCodeAt(t);
    return a === r.CARRIAGE_RETURN ? r.LINE_FEED : a;
  }
  advance() {
    if (this.pos++, this.isEol && (this.isEol = !1, this.line++, this.lineStartPos = this.pos), this.pos >= this.html.length)
      return this.endOfChunkHit = !this.lastChunkWritten, r.EOF;
    let e = this.html.charCodeAt(this.pos);
    return e === r.CARRIAGE_RETURN ? (this.isEol = !0, this.skipNextNewLine = !0, r.LINE_FEED) : e === r.LINE_FEED && (this.isEol = !0, this.skipNextNewLine) ? (this.line--, this.skipNextNewLine = !1, this._addGap(), this.advance()) : (this.skipNextNewLine = !1, Oe(e) && (e = this._processSurrogate(e)), this.handler.onParseError === null || e > 31 && e < 127 || e === r.LINE_FEED || e === r.CARRIAGE_RETURN || e > 159 && e < 64976 || this._checkForProblematicCharacters(e), e);
  }
  _checkForProblematicCharacters(e) {
    Se(e) ? this._err(E.controlCharacterInInputStream) : Le(e) && this._err(E.noncharacterInInputStream);
  }
  retreat(e) {
    for (this.pos -= e; this.pos < this.lastGapPos; )
      this.lastGapPos = this.gapStack.pop(), this.pos--;
    this.isEol = !1;
  }
}, d;
(function(e) {
  e[e.CHARACTER = 0] = "CHARACTER", e[e.NULL_CHARACTER = 1] = "NULL_CHARACTER", e[e.WHITESPACE_CHARACTER = 2] = "WHITESPACE_CHARACTER", e[e.START_TAG = 3] = "START_TAG", e[e.END_TAG = 4] = "END_TAG", e[e.COMMENT = 5] = "COMMENT", e[e.DOCTYPE = 6] = "DOCTYPE", e[e.EOF = 7] = "EOF", e[e.HIBERNATION = 8] = "HIBERNATION";
})(d || (d = {}));
function Re(e, t) {
  for (let a = e.attrs.length - 1; a >= 0; a--) if (e.attrs[a].name === t) return e.attrs[a].value;
  return null;
}
const et = /* @__PURE__ */ new Uint16Array(/* @__PURE__ */ 'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'.split("").map((e) => e.charCodeAt(0))), tt = /* @__PURE__ */ new Map([
  [0, 65533],
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
]);
function st(e) {
  var t;
  return e >= 55296 && e <= 57343 || e > 1114111 ? 65533 : (t = tt.get(e)) !== null && t !== void 0 ? t : e;
}
var N;
(function(e) {
  e[e.NUM = 35] = "NUM", e[e.SEMI = 59] = "SEMI", e[e.EQUALS = 61] = "EQUALS", e[e.ZERO = 48] = "ZERO", e[e.NINE = 57] = "NINE", e[e.LOWER_A = 97] = "LOWER_A", e[e.LOWER_F = 102] = "LOWER_F", e[e.LOWER_X = 120] = "LOWER_X", e[e.LOWER_Z = 122] = "LOWER_Z", e[e.UPPER_A = 65] = "UPPER_A", e[e.UPPER_F = 70] = "UPPER_F", e[e.UPPER_Z = 90] = "UPPER_Z";
})(N || (N = {}));
const at = 32;
var b;
(function(e) {
  e[e.VALUE_LENGTH = 49152] = "VALUE_LENGTH", e[e.BRANCH_LENGTH = 16256] = "BRANCH_LENGTH", e[e.JUMP_TABLE = 127] = "JUMP_TABLE";
})(b || (b = {}));
function ae(e) {
  return e >= N.ZERO && e <= N.NINE;
}
function rt(e) {
  return e >= N.UPPER_A && e <= N.UPPER_F || e >= N.LOWER_A && e <= N.LOWER_F;
}
function it(e) {
  return e >= N.UPPER_A && e <= N.UPPER_Z || e >= N.LOWER_A && e <= N.LOWER_Z || ae(e);
}
function nt(e) {
  return e === N.EQUALS || it(e);
}
var A;
(function(e) {
  e[e.EntityStart = 0] = "EntityStart", e[e.NumericStart = 1] = "NumericStart", e[e.NumericDecimal = 2] = "NumericDecimal", e[e.NumericHex = 3] = "NumericHex", e[e.NamedEntity = 4] = "NamedEntity";
})(A || (A = {}));
var p;
(function(e) {
  e[e.Legacy = 0] = "Legacy", e[e.Strict = 1] = "Strict", e[e.Attribute = 2] = "Attribute";
})(p || (p = {}));
var ot = class {
  constructor(e, t, a) {
    this.decodeTree = e, this.emitCodePoint = t, this.errors = a, this.state = A.EntityStart, this.consumed = 1, this.result = 0, this.treeIndex = 0, this.excess = 1, this.decodeMode = p.Strict;
  }
  /** Resets the instance to make it reusable. */
  startEntity(e) {
    this.decodeMode = e, this.state = A.EntityStart, this.result = 0, this.treeIndex = 0, this.excess = 1, this.consumed = 1;
  }
  /**
  * Write an entity to the decoder. This can be called multiple times with partial entities.
  * If the entity is incomplete, the decoder will return -1.
  *
  * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
  * entity is incomplete, and resume when the next string is written.
  *
  * @param input The string containing the entity (or a continuation of the entity).
  * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
  * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
  */
  write(e, t) {
    switch (this.state) {
      case A.EntityStart:
        return e.charCodeAt(t) === N.NUM ? (this.state = A.NumericStart, this.consumed += 1, this.stateNumericStart(e, t + 1)) : (this.state = A.NamedEntity, this.stateNamedEntity(e, t));
      case A.NumericStart:
        return this.stateNumericStart(e, t);
      case A.NumericDecimal:
        return this.stateNumericDecimal(e, t);
      case A.NumericHex:
        return this.stateNumericHex(e, t);
      case A.NamedEntity:
        return this.stateNamedEntity(e, t);
    }
  }
  /**
  * Switches between the numeric decimal and hexadecimal states.
  *
  * Equivalent to the `Numeric character reference state` in the HTML spec.
  *
  * @param input The string containing the entity (or a continuation of the entity).
  * @param offset The current offset.
  * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
  */
  stateNumericStart(e, t) {
    return t >= e.length ? -1 : (e.charCodeAt(t) | at) === N.LOWER_X ? (this.state = A.NumericHex, this.consumed += 1, this.stateNumericHex(e, t + 1)) : (this.state = A.NumericDecimal, this.stateNumericDecimal(e, t));
  }
  addToNumericResult(e, t, a, o) {
    if (t !== a) {
      const T = a - t;
      this.result = this.result * Math.pow(o, T) + Number.parseInt(e.substr(t, T), o), this.consumed += T;
    }
  }
  /**
  * Parses a hexadecimal numeric entity.
  *
  * Equivalent to the `Hexademical character reference state` in the HTML spec.
  *
  * @param input The string containing the entity (or a continuation of the entity).
  * @param offset The current offset.
  * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
  */
  stateNumericHex(e, t) {
    const a = t;
    for (; t < e.length; ) {
      const o = e.charCodeAt(t);
      if (ae(o) || rt(o)) t += 1;
      else
        return this.addToNumericResult(e, a, t, 16), this.emitNumericEntity(o, 3);
    }
    return this.addToNumericResult(e, a, t, 16), -1;
  }
  /**
  * Parses a decimal numeric entity.
  *
  * Equivalent to the `Decimal character reference state` in the HTML spec.
  *
  * @param input The string containing the entity (or a continuation of the entity).
  * @param offset The current offset.
  * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
  */
  stateNumericDecimal(e, t) {
    const a = t;
    for (; t < e.length; ) {
      const o = e.charCodeAt(t);
      if (ae(o)) t += 1;
      else
        return this.addToNumericResult(e, a, t, 10), this.emitNumericEntity(o, 2);
    }
    return this.addToNumericResult(e, a, t, 10), -1;
  }
  /**
  * Validate and emit a numeric entity.
  *
  * Implements the logic from the `Hexademical character reference start
  * state` and `Numeric character reference end state` in the HTML spec.
  *
  * @param lastCp The last code point of the entity. Used to see if the
  *               entity was terminated with a semicolon.
  * @param expectedLength The minimum number of characters that should be
  *                       consumed. Used to validate that at least one digit
  *                       was consumed.
  * @returns The number of characters that were consumed.
  */
  emitNumericEntity(e, t) {
    var a;
    if (this.consumed <= t)
      return (a = this.errors) === null || a === void 0 || a.absenceOfDigitsInNumericCharacterReference(this.consumed), 0;
    if (e === N.SEMI) this.consumed += 1;
    else if (this.decodeMode === p.Strict) return 0;
    return this.emitCodePoint(st(this.result), this.consumed), this.errors && (e !== N.SEMI && this.errors.missingSemicolonAfterCharacterReference(), this.errors.validateNumericCharacterReference(this.result)), this.consumed;
  }
  /**
  * Parses a named entity.
  *
  * Equivalent to the `Named character reference state` in the HTML spec.
  *
  * @param input The string containing the entity (or a continuation of the entity).
  * @param offset The current offset.
  * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
  */
  stateNamedEntity(e, t) {
    const { decodeTree: a } = this;
    let o = a[this.treeIndex], T = (o & b.VALUE_LENGTH) >> 14;
    for (; t < e.length; t++, this.excess++) {
      const _ = e.charCodeAt(t);
      if (this.treeIndex = ct(a, o, this.treeIndex + Math.max(1, T), _), this.treeIndex < 0) return this.result === 0 || this.decodeMode === p.Attribute && (T === 0 || nt(_)) ? 0 : this.emitNotTerminatedNamedEntity();
      if (o = a[this.treeIndex], T = (o & b.VALUE_LENGTH) >> 14, T !== 0) {
        if (_ === N.SEMI) return this.emitNamedEntityData(this.treeIndex, T, this.consumed + this.excess);
        this.decodeMode !== p.Strict && (this.result = this.treeIndex, this.consumed += this.excess, this.excess = 0);
      }
    }
    return -1;
  }
  /**
  * Emit a named entity that was not terminated with a semicolon.
  *
  * @returns The number of characters consumed.
  */
  emitNotTerminatedNamedEntity() {
    var e;
    const { result: t, decodeTree: a } = this, o = (a[t] & b.VALUE_LENGTH) >> 14;
    return this.emitNamedEntityData(t, o, this.consumed), (e = this.errors) === null || e === void 0 || e.missingSemicolonAfterCharacterReference(), this.consumed;
  }
  /**
  * Emit a named entity.
  *
  * @param result The index of the entity in the decode tree.
  * @param valueLength The number of bytes in the entity.
  * @param consumed The number of characters consumed.
  *
  * @returns The number of characters consumed.
  */
  emitNamedEntityData(e, t, a) {
    const { decodeTree: o } = this;
    return this.emitCodePoint(t === 1 ? o[e] & ~b.VALUE_LENGTH : o[e + 1], a), t === 3 && this.emitCodePoint(o[e + 2], a), a;
  }
  /**
  * Signal to the parser that the end of the input was reached.
  *
  * Remaining data will be emitted and relevant errors will be produced.
  *
  * @returns The number of characters consumed.
  */
  end() {
    var e;
    switch (this.state) {
      case A.NamedEntity:
        return this.result !== 0 && (this.decodeMode !== p.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      case A.NumericDecimal:
        return this.emitNumericEntity(0, 2);
      case A.NumericHex:
        return this.emitNumericEntity(0, 3);
      case A.NumericStart:
        return (e = this.errors) === null || e === void 0 || e.absenceOfDigitsInNumericCharacterReference(this.consumed), 0;
      case A.EntityStart:
        return 0;
    }
  }
};
function ct(e, t, a, o) {
  const T = (t & b.BRANCH_LENGTH) >> 7, _ = t & b.JUMP_TABLE;
  if (T === 0) return _ !== 0 && o === _ ? a : -1;
  if (_) {
    const C = o - _;
    return C < 0 || C >= T ? -1 : e[a + C] - 1;
  }
  let m = a, I = m + T - 1;
  for (; m <= I; ) {
    const C = m + I >>> 1, k = e[C];
    if (k < o) m = C + 1;
    else if (k > o) I = C - 1;
    else return e[C + T];
  }
  return -1;
}
var h;
(function(e) {
  e.HTML = "http://www.w3.org/1999/xhtml", e.MATHML = "http://www.w3.org/1998/Math/MathML", e.SVG = "http://www.w3.org/2000/svg", e.XLINK = "http://www.w3.org/1999/xlink", e.XML = "http://www.w3.org/XML/1998/namespace", e.XMLNS = "http://www.w3.org/2000/xmlns/";
})(h || (h = {}));
var M;
(function(e) {
  e.TYPE = "type", e.ACTION = "action", e.ENCODING = "encoding", e.PROMPT = "prompt", e.NAME = "name", e.COLOR = "color", e.FACE = "face", e.SIZE = "size";
})(M || (M = {}));
var L;
(function(e) {
  e.NO_QUIRKS = "no-quirks", e.QUIRKS = "quirks", e.LIMITED_QUIRKS = "limited-quirks";
})(L || (L = {}));
var c;
(function(e) {
  e.A = "a", e.ADDRESS = "address", e.ANNOTATION_XML = "annotation-xml", e.APPLET = "applet", e.AREA = "area", e.ARTICLE = "article", e.ASIDE = "aside", e.B = "b", e.BASE = "base", e.BASEFONT = "basefont", e.BGSOUND = "bgsound", e.BIG = "big", e.BLOCKQUOTE = "blockquote", e.BODY = "body", e.BR = "br", e.BUTTON = "button", e.CAPTION = "caption", e.CENTER = "center", e.CODE = "code", e.COL = "col", e.COLGROUP = "colgroup", e.DD = "dd", e.DESC = "desc", e.DETAILS = "details", e.DIALOG = "dialog", e.DIR = "dir", e.DIV = "div", e.DL = "dl", e.DT = "dt", e.EM = "em", e.EMBED = "embed", e.FIELDSET = "fieldset", e.FIGCAPTION = "figcaption", e.FIGURE = "figure", e.FONT = "font", e.FOOTER = "footer", e.FOREIGN_OBJECT = "foreignObject", e.FORM = "form", e.FRAME = "frame", e.FRAMESET = "frameset", e.H1 = "h1", e.H2 = "h2", e.H3 = "h3", e.H4 = "h4", e.H5 = "h5", e.H6 = "h6", e.HEAD = "head", e.HEADER = "header", e.HGROUP = "hgroup", e.HR = "hr", e.HTML = "html", e.I = "i", e.IMG = "img", e.IMAGE = "image", e.INPUT = "input", e.IFRAME = "iframe", e.KEYGEN = "keygen", e.LABEL = "label", e.LI = "li", e.LINK = "link", e.LISTING = "listing", e.MAIN = "main", e.MALIGNMARK = "malignmark", e.MARQUEE = "marquee", e.MATH = "math", e.MENU = "menu", e.META = "meta", e.MGLYPH = "mglyph", e.MI = "mi", e.MO = "mo", e.MN = "mn", e.MS = "ms", e.MTEXT = "mtext", e.NAV = "nav", e.NOBR = "nobr", e.NOFRAMES = "noframes", e.NOEMBED = "noembed", e.NOSCRIPT = "noscript", e.OBJECT = "object", e.OL = "ol", e.OPTGROUP = "optgroup", e.OPTION = "option", e.P = "p", e.PARAM = "param", e.PLAINTEXT = "plaintext", e.PRE = "pre", e.RB = "rb", e.RP = "rp", e.RT = "rt", e.RTC = "rtc", e.RUBY = "ruby", e.S = "s", e.SCRIPT = "script", e.SEARCH = "search", e.SECTION = "section", e.SELECT = "select", e.SOURCE = "source", e.SMALL = "small", e.SPAN = "span", e.STRIKE = "strike", e.STRONG = "strong", e.STYLE = "style", e.SUB = "sub", e.SUMMARY = "summary", e.SUP = "sup", e.TABLE = "table", e.TBODY = "tbody", e.TEMPLATE = "template", e.TEXTAREA = "textarea", e.TFOOT = "tfoot", e.TD = "td", e.TH = "th", e.THEAD = "thead", e.TITLE = "title", e.TR = "tr", e.TRACK = "track", e.TT = "tt", e.U = "u", e.UL = "ul", e.SVG = "svg", e.VAR = "var", e.WBR = "wbr", e.XMP = "xmp";
})(c || (c = {}));
var s;
(function(e) {
  e[e.UNKNOWN = 0] = "UNKNOWN", e[e.A = 1] = "A", e[e.ADDRESS = 2] = "ADDRESS", e[e.ANNOTATION_XML = 3] = "ANNOTATION_XML", e[e.APPLET = 4] = "APPLET", e[e.AREA = 5] = "AREA", e[e.ARTICLE = 6] = "ARTICLE", e[e.ASIDE = 7] = "ASIDE", e[e.B = 8] = "B", e[e.BASE = 9] = "BASE", e[e.BASEFONT = 10] = "BASEFONT", e[e.BGSOUND = 11] = "BGSOUND", e[e.BIG = 12] = "BIG", e[e.BLOCKQUOTE = 13] = "BLOCKQUOTE", e[e.BODY = 14] = "BODY", e[e.BR = 15] = "BR", e[e.BUTTON = 16] = "BUTTON", e[e.CAPTION = 17] = "CAPTION", e[e.CENTER = 18] = "CENTER", e[e.CODE = 19] = "CODE", e[e.COL = 20] = "COL", e[e.COLGROUP = 21] = "COLGROUP", e[e.DD = 22] = "DD", e[e.DESC = 23] = "DESC", e[e.DETAILS = 24] = "DETAILS", e[e.DIALOG = 25] = "DIALOG", e[e.DIR = 26] = "DIR", e[e.DIV = 27] = "DIV", e[e.DL = 28] = "DL", e[e.DT = 29] = "DT", e[e.EM = 30] = "EM", e[e.EMBED = 31] = "EMBED", e[e.FIELDSET = 32] = "FIELDSET", e[e.FIGCAPTION = 33] = "FIGCAPTION", e[e.FIGURE = 34] = "FIGURE", e[e.FONT = 35] = "FONT", e[e.FOOTER = 36] = "FOOTER", e[e.FOREIGN_OBJECT = 37] = "FOREIGN_OBJECT", e[e.FORM = 38] = "FORM", e[e.FRAME = 39] = "FRAME", e[e.FRAMESET = 40] = "FRAMESET", e[e.H1 = 41] = "H1", e[e.H2 = 42] = "H2", e[e.H3 = 43] = "H3", e[e.H4 = 44] = "H4", e[e.H5 = 45] = "H5", e[e.H6 = 46] = "H6", e[e.HEAD = 47] = "HEAD", e[e.HEADER = 48] = "HEADER", e[e.HGROUP = 49] = "HGROUP", e[e.HR = 50] = "HR", e[e.HTML = 51] = "HTML", e[e.I = 52] = "I", e[e.IMG = 53] = "IMG", e[e.IMAGE = 54] = "IMAGE", e[e.INPUT = 55] = "INPUT", e[e.IFRAME = 56] = "IFRAME", e[e.KEYGEN = 57] = "KEYGEN", e[e.LABEL = 58] = "LABEL", e[e.LI = 59] = "LI", e[e.LINK = 60] = "LINK", e[e.LISTING = 61] = "LISTING", e[e.MAIN = 62] = "MAIN", e[e.MALIGNMARK = 63] = "MALIGNMARK", e[e.MARQUEE = 64] = "MARQUEE", e[e.MATH = 65] = "MATH", e[e.MENU = 66] = "MENU", e[e.META = 67] = "META", e[e.MGLYPH = 68] = "MGLYPH", e[e.MI = 69] = "MI", e[e.MO = 70] = "MO", e[e.MN = 71] = "MN", e[e.MS = 72] = "MS", e[e.MTEXT = 73] = "MTEXT", e[e.NAV = 74] = "NAV", e[e.NOBR = 75] = "NOBR", e[e.NOFRAMES = 76] = "NOFRAMES", e[e.NOEMBED = 77] = "NOEMBED", e[e.NOSCRIPT = 78] = "NOSCRIPT", e[e.OBJECT = 79] = "OBJECT", e[e.OL = 80] = "OL", e[e.OPTGROUP = 81] = "OPTGROUP", e[e.OPTION = 82] = "OPTION", e[e.P = 83] = "P", e[e.PARAM = 84] = "PARAM", e[e.PLAINTEXT = 85] = "PLAINTEXT", e[e.PRE = 86] = "PRE", e[e.RB = 87] = "RB", e[e.RP = 88] = "RP", e[e.RT = 89] = "RT", e[e.RTC = 90] = "RTC", e[e.RUBY = 91] = "RUBY", e[e.S = 92] = "S", e[e.SCRIPT = 93] = "SCRIPT", e[e.SEARCH = 94] = "SEARCH", e[e.SECTION = 95] = "SECTION", e[e.SELECT = 96] = "SELECT", e[e.SOURCE = 97] = "SOURCE", e[e.SMALL = 98] = "SMALL", e[e.SPAN = 99] = "SPAN", e[e.STRIKE = 100] = "STRIKE", e[e.STRONG = 101] = "STRONG", e[e.STYLE = 102] = "STYLE", e[e.SUB = 103] = "SUB", e[e.SUMMARY = 104] = "SUMMARY", e[e.SUP = 105] = "SUP", e[e.TABLE = 106] = "TABLE", e[e.TBODY = 107] = "TBODY", e[e.TEMPLATE = 108] = "TEMPLATE", e[e.TEXTAREA = 109] = "TEXTAREA", e[e.TFOOT = 110] = "TFOOT", e[e.TD = 111] = "TD", e[e.TH = 112] = "TH", e[e.THEAD = 113] = "THEAD", e[e.TITLE = 114] = "TITLE", e[e.TR = 115] = "TR", e[e.TRACK = 116] = "TRACK", e[e.TT = 117] = "TT", e[e.U = 118] = "U", e[e.UL = 119] = "UL", e[e.SVG = 120] = "SVG", e[e.VAR = 121] = "VAR", e[e.WBR = 122] = "WBR", e[e.XMP = 123] = "XMP";
})(s || (s = {}));
const Et = /* @__PURE__ */ new Map([
  [c.A, s.A],
  [c.ADDRESS, s.ADDRESS],
  [c.ANNOTATION_XML, s.ANNOTATION_XML],
  [c.APPLET, s.APPLET],
  [c.AREA, s.AREA],
  [c.ARTICLE, s.ARTICLE],
  [c.ASIDE, s.ASIDE],
  [c.B, s.B],
  [c.BASE, s.BASE],
  [c.BASEFONT, s.BASEFONT],
  [c.BGSOUND, s.BGSOUND],
  [c.BIG, s.BIG],
  [c.BLOCKQUOTE, s.BLOCKQUOTE],
  [c.BODY, s.BODY],
  [c.BR, s.BR],
  [c.BUTTON, s.BUTTON],
  [c.CAPTION, s.CAPTION],
  [c.CENTER, s.CENTER],
  [c.CODE, s.CODE],
  [c.COL, s.COL],
  [c.COLGROUP, s.COLGROUP],
  [c.DD, s.DD],
  [c.DESC, s.DESC],
  [c.DETAILS, s.DETAILS],
  [c.DIALOG, s.DIALOG],
  [c.DIR, s.DIR],
  [c.DIV, s.DIV],
  [c.DL, s.DL],
  [c.DT, s.DT],
  [c.EM, s.EM],
  [c.EMBED, s.EMBED],
  [c.FIELDSET, s.FIELDSET],
  [c.FIGCAPTION, s.FIGCAPTION],
  [c.FIGURE, s.FIGURE],
  [c.FONT, s.FONT],
  [c.FOOTER, s.FOOTER],
  [c.FOREIGN_OBJECT, s.FOREIGN_OBJECT],
  [c.FORM, s.FORM],
  [c.FRAME, s.FRAME],
  [c.FRAMESET, s.FRAMESET],
  [c.H1, s.H1],
  [c.H2, s.H2],
  [c.H3, s.H3],
  [c.H4, s.H4],
  [c.H5, s.H5],
  [c.H6, s.H6],
  [c.HEAD, s.HEAD],
  [c.HEADER, s.HEADER],
  [c.HGROUP, s.HGROUP],
  [c.HR, s.HR],
  [c.HTML, s.HTML],
  [c.I, s.I],
  [c.IMG, s.IMG],
  [c.IMAGE, s.IMAGE],
  [c.INPUT, s.INPUT],
  [c.IFRAME, s.IFRAME],
  [c.KEYGEN, s.KEYGEN],
  [c.LABEL, s.LABEL],
  [c.LI, s.LI],
  [c.LINK, s.LINK],
  [c.LISTING, s.LISTING],
  [c.MAIN, s.MAIN],
  [c.MALIGNMARK, s.MALIGNMARK],
  [c.MARQUEE, s.MARQUEE],
  [c.MATH, s.MATH],
  [c.MENU, s.MENU],
  [c.META, s.META],
  [c.MGLYPH, s.MGLYPH],
  [c.MI, s.MI],
  [c.MO, s.MO],
  [c.MN, s.MN],
  [c.MS, s.MS],
  [c.MTEXT, s.MTEXT],
  [c.NAV, s.NAV],
  [c.NOBR, s.NOBR],
  [c.NOFRAMES, s.NOFRAMES],
  [c.NOEMBED, s.NOEMBED],
  [c.NOSCRIPT, s.NOSCRIPT],
  [c.OBJECT, s.OBJECT],
  [c.OL, s.OL],
  [c.OPTGROUP, s.OPTGROUP],
  [c.OPTION, s.OPTION],
  [c.P, s.P],
  [c.PARAM, s.PARAM],
  [c.PLAINTEXT, s.PLAINTEXT],
  [c.PRE, s.PRE],
  [c.RB, s.RB],
  [c.RP, s.RP],
  [c.RT, s.RT],
  [c.RTC, s.RTC],
  [c.RUBY, s.RUBY],
  [c.S, s.S],
  [c.SCRIPT, s.SCRIPT],
  [c.SEARCH, s.SEARCH],
  [c.SECTION, s.SECTION],
  [c.SELECT, s.SELECT],
  [c.SOURCE, s.SOURCE],
  [c.SMALL, s.SMALL],
  [c.SPAN, s.SPAN],
  [c.STRIKE, s.STRIKE],
  [c.STRONG, s.STRONG],
  [c.STYLE, s.STYLE],
  [c.SUB, s.SUB],
  [c.SUMMARY, s.SUMMARY],
  [c.SUP, s.SUP],
  [c.TABLE, s.TABLE],
  [c.TBODY, s.TBODY],
  [c.TEMPLATE, s.TEMPLATE],
  [c.TEXTAREA, s.TEXTAREA],
  [c.TFOOT, s.TFOOT],
  [c.TD, s.TD],
  [c.TH, s.TH],
  [c.THEAD, s.THEAD],
  [c.TITLE, s.TITLE],
  [c.TR, s.TR],
  [c.TRACK, s.TRACK],
  [c.TT, s.TT],
  [c.U, s.U],
  [c.UL, s.UL],
  [c.SVG, s.SVG],
  [c.VAR, s.VAR],
  [c.WBR, s.WBR],
  [c.XMP, s.XMP]
]);
function J(e) {
  var t;
  return (t = Et.get(e)) !== null && t !== void 0 ? t : s.UNKNOWN;
}
const l = s, Tt = {
  [h.HTML]: /* @__PURE__ */ new Set([
    l.ADDRESS,
    l.APPLET,
    l.AREA,
    l.ARTICLE,
    l.ASIDE,
    l.BASE,
    l.BASEFONT,
    l.BGSOUND,
    l.BLOCKQUOTE,
    l.BODY,
    l.BR,
    l.BUTTON,
    l.CAPTION,
    l.CENTER,
    l.COL,
    l.COLGROUP,
    l.DD,
    l.DETAILS,
    l.DIR,
    l.DIV,
    l.DL,
    l.DT,
    l.EMBED,
    l.FIELDSET,
    l.FIGCAPTION,
    l.FIGURE,
    l.FOOTER,
    l.FORM,
    l.FRAME,
    l.FRAMESET,
    l.H1,
    l.H2,
    l.H3,
    l.H4,
    l.H5,
    l.H6,
    l.HEAD,
    l.HEADER,
    l.HGROUP,
    l.HR,
    l.HTML,
    l.IFRAME,
    l.IMG,
    l.INPUT,
    l.LI,
    l.LINK,
    l.LISTING,
    l.MAIN,
    l.MARQUEE,
    l.MENU,
    l.META,
    l.NAV,
    l.NOEMBED,
    l.NOFRAMES,
    l.NOSCRIPT,
    l.OBJECT,
    l.OL,
    l.P,
    l.PARAM,
    l.PLAINTEXT,
    l.PRE,
    l.SCRIPT,
    l.SECTION,
    l.SELECT,
    l.SOURCE,
    l.STYLE,
    l.SUMMARY,
    l.TABLE,
    l.TBODY,
    l.TD,
    l.TEMPLATE,
    l.TEXTAREA,
    l.TFOOT,
    l.TH,
    l.THEAD,
    l.TITLE,
    l.TR,
    l.TRACK,
    l.UL,
    l.WBR,
    l.XMP
  ]),
  [h.MATHML]: /* @__PURE__ */ new Set([
    l.MI,
    l.MO,
    l.MN,
    l.MS,
    l.MTEXT,
    l.ANNOTATION_XML
  ]),
  [h.SVG]: /* @__PURE__ */ new Set([
    l.TITLE,
    l.FOREIGN_OBJECT,
    l.DESC
  ]),
  [h.XLINK]: /* @__PURE__ */ new Set(),
  [h.XML]: /* @__PURE__ */ new Set(),
  [h.XMLNS]: /* @__PURE__ */ new Set()
}, re = /* @__PURE__ */ new Set([
  l.H1,
  l.H2,
  l.H3,
  l.H4,
  l.H5,
  l.H6
]);
var i;
(function(e) {
  e[e.DATA = 0] = "DATA", e[e.RCDATA = 1] = "RCDATA", e[e.RAWTEXT = 2] = "RAWTEXT", e[e.SCRIPT_DATA = 3] = "SCRIPT_DATA", e[e.PLAINTEXT = 4] = "PLAINTEXT", e[e.TAG_OPEN = 5] = "TAG_OPEN", e[e.END_TAG_OPEN = 6] = "END_TAG_OPEN", e[e.TAG_NAME = 7] = "TAG_NAME", e[e.RCDATA_LESS_THAN_SIGN = 8] = "RCDATA_LESS_THAN_SIGN", e[e.RCDATA_END_TAG_OPEN = 9] = "RCDATA_END_TAG_OPEN", e[e.RCDATA_END_TAG_NAME = 10] = "RCDATA_END_TAG_NAME", e[e.RAWTEXT_LESS_THAN_SIGN = 11] = "RAWTEXT_LESS_THAN_SIGN", e[e.RAWTEXT_END_TAG_OPEN = 12] = "RAWTEXT_END_TAG_OPEN", e[e.RAWTEXT_END_TAG_NAME = 13] = "RAWTEXT_END_TAG_NAME", e[e.SCRIPT_DATA_LESS_THAN_SIGN = 14] = "SCRIPT_DATA_LESS_THAN_SIGN", e[e.SCRIPT_DATA_END_TAG_OPEN = 15] = "SCRIPT_DATA_END_TAG_OPEN", e[e.SCRIPT_DATA_END_TAG_NAME = 16] = "SCRIPT_DATA_END_TAG_NAME", e[e.SCRIPT_DATA_ESCAPE_START = 17] = "SCRIPT_DATA_ESCAPE_START", e[e.SCRIPT_DATA_ESCAPE_START_DASH = 18] = "SCRIPT_DATA_ESCAPE_START_DASH", e[e.SCRIPT_DATA_ESCAPED = 19] = "SCRIPT_DATA_ESCAPED", e[e.SCRIPT_DATA_ESCAPED_DASH = 20] = "SCRIPT_DATA_ESCAPED_DASH", e[e.SCRIPT_DATA_ESCAPED_DASH_DASH = 21] = "SCRIPT_DATA_ESCAPED_DASH_DASH", e[e.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN = 22] = "SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN", e[e.SCRIPT_DATA_ESCAPED_END_TAG_OPEN = 23] = "SCRIPT_DATA_ESCAPED_END_TAG_OPEN", e[e.SCRIPT_DATA_ESCAPED_END_TAG_NAME = 24] = "SCRIPT_DATA_ESCAPED_END_TAG_NAME", e[e.SCRIPT_DATA_DOUBLE_ESCAPE_START = 25] = "SCRIPT_DATA_DOUBLE_ESCAPE_START", e[e.SCRIPT_DATA_DOUBLE_ESCAPED = 26] = "SCRIPT_DATA_DOUBLE_ESCAPED", e[e.SCRIPT_DATA_DOUBLE_ESCAPED_DASH = 27] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH", e[e.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH = 28] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH", e[e.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN = 29] = "SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN", e[e.SCRIPT_DATA_DOUBLE_ESCAPE_END = 30] = "SCRIPT_DATA_DOUBLE_ESCAPE_END", e[e.BEFORE_ATTRIBUTE_NAME = 31] = "BEFORE_ATTRIBUTE_NAME", e[e.ATTRIBUTE_NAME = 32] = "ATTRIBUTE_NAME", e[e.AFTER_ATTRIBUTE_NAME = 33] = "AFTER_ATTRIBUTE_NAME", e[e.BEFORE_ATTRIBUTE_VALUE = 34] = "BEFORE_ATTRIBUTE_VALUE", e[e.ATTRIBUTE_VALUE_DOUBLE_QUOTED = 35] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED", e[e.ATTRIBUTE_VALUE_SINGLE_QUOTED = 36] = "ATTRIBUTE_VALUE_SINGLE_QUOTED", e[e.ATTRIBUTE_VALUE_UNQUOTED = 37] = "ATTRIBUTE_VALUE_UNQUOTED", e[e.AFTER_ATTRIBUTE_VALUE_QUOTED = 38] = "AFTER_ATTRIBUTE_VALUE_QUOTED", e[e.SELF_CLOSING_START_TAG = 39] = "SELF_CLOSING_START_TAG", e[e.BOGUS_COMMENT = 40] = "BOGUS_COMMENT", e[e.MARKUP_DECLARATION_OPEN = 41] = "MARKUP_DECLARATION_OPEN", e[e.COMMENT_START = 42] = "COMMENT_START", e[e.COMMENT_START_DASH = 43] = "COMMENT_START_DASH", e[e.COMMENT = 44] = "COMMENT", e[e.COMMENT_LESS_THAN_SIGN = 45] = "COMMENT_LESS_THAN_SIGN", e[e.COMMENT_LESS_THAN_SIGN_BANG = 46] = "COMMENT_LESS_THAN_SIGN_BANG", e[e.COMMENT_LESS_THAN_SIGN_BANG_DASH = 47] = "COMMENT_LESS_THAN_SIGN_BANG_DASH", e[e.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH = 48] = "COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH", e[e.COMMENT_END_DASH = 49] = "COMMENT_END_DASH", e[e.COMMENT_END = 50] = "COMMENT_END", e[e.COMMENT_END_BANG = 51] = "COMMENT_END_BANG", e[e.DOCTYPE = 52] = "DOCTYPE", e[e.BEFORE_DOCTYPE_NAME = 53] = "BEFORE_DOCTYPE_NAME", e[e.DOCTYPE_NAME = 54] = "DOCTYPE_NAME", e[e.AFTER_DOCTYPE_NAME = 55] = "AFTER_DOCTYPE_NAME", e[e.AFTER_DOCTYPE_PUBLIC_KEYWORD = 56] = "AFTER_DOCTYPE_PUBLIC_KEYWORD", e[e.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER = 57] = "BEFORE_DOCTYPE_PUBLIC_IDENTIFIER", e[e.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED = 58] = "DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED", e[e.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED = 59] = "DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED", e[e.AFTER_DOCTYPE_PUBLIC_IDENTIFIER = 60] = "AFTER_DOCTYPE_PUBLIC_IDENTIFIER", e[e.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS = 61] = "BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS", e[e.AFTER_DOCTYPE_SYSTEM_KEYWORD = 62] = "AFTER_DOCTYPE_SYSTEM_KEYWORD", e[e.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER = 63] = "BEFORE_DOCTYPE_SYSTEM_IDENTIFIER", e[e.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED = 64] = "DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED", e[e.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED = 65] = "DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED", e[e.AFTER_DOCTYPE_SYSTEM_IDENTIFIER = 66] = "AFTER_DOCTYPE_SYSTEM_IDENTIFIER", e[e.BOGUS_DOCTYPE = 67] = "BOGUS_DOCTYPE", e[e.CDATA_SECTION = 68] = "CDATA_SECTION", e[e.CDATA_SECTION_BRACKET = 69] = "CDATA_SECTION_BRACKET", e[e.CDATA_SECTION_END = 70] = "CDATA_SECTION_END", e[e.CHARACTER_REFERENCE = 71] = "CHARACTER_REFERENCE", e[e.AMBIGUOUS_AMPERSAND = 72] = "AMBIGUOUS_AMPERSAND";
})(i || (i = {}));
const S = {
  DATA: i.DATA,
  RCDATA: i.RCDATA,
  RAWTEXT: i.RAWTEXT,
  SCRIPT_DATA: i.SCRIPT_DATA,
  PLAINTEXT: i.PLAINTEXT,
  CDATA_SECTION: i.CDATA_SECTION
};
function ht(e) {
  return e >= r.DIGIT_0 && e <= r.DIGIT_9;
}
function y(e) {
  return e >= r.LATIN_CAPITAL_A && e <= r.LATIN_CAPITAL_Z;
}
function lt(e) {
  return e >= r.LATIN_SMALL_A && e <= r.LATIN_SMALL_Z;
}
function g(e) {
  return lt(e) || y(e);
}
function he(e) {
  return g(e) || ht(e);
}
function q(e) {
  return e + 32;
}
function De(e) {
  return e === r.SPACE || e === r.LINE_FEED || e === r.TABULATION || e === r.FORM_FEED;
}
function le(e) {
  return De(e) || e === r.SOLIDUS || e === r.GREATER_THAN_SIGN;
}
function _t(e) {
  return e === r.NULL ? E.nullCharacterReference : e > 1114111 ? E.characterReferenceOutsideUnicodeRange : Oe(e) ? E.surrogateCharacterReference : Le(e) ? E.noncharacterCharacterReference : Se(e) || e === r.CARRIAGE_RETURN ? E.controlCharacterReference : null;
}
var mt = class {
  constructor(e, t) {
    this.options = e, this.handler = t, this.paused = !1, this.inLoop = !1, this.inForeignNode = !1, this.lastStartTagName = "", this.active = !1, this.state = i.DATA, this.returnState = i.DATA, this.entityStartPos = 0, this.consumedAfterSnapshot = -1, this.currentCharacterToken = null, this.currentToken = null, this.currentAttr = {
      name: "",
      value: ""
    }, this.preprocessor = new $e(t), this.currentLocation = this.getCurrentLocation(-1), this.entityDecoder = new ot(et, (a, o) => {
      this.preprocessor.pos = this.entityStartPos + o - 1, this._flushCodePointConsumedAsCharacterReference(a);
    }, t.onParseError ? {
      missingSemicolonAfterCharacterReference: () => {
        this._err(E.missingSemicolonAfterCharacterReference, 1);
      },
      absenceOfDigitsInNumericCharacterReference: (a) => {
        this._err(E.absenceOfDigitsInNumericCharacterReference, this.entityStartPos - this.preprocessor.pos + a);
      },
      validateNumericCharacterReference: (a) => {
        const o = _t(a);
        o && this._err(o, 1);
      }
    } : void 0);
  }
  _err(e, t = 0) {
    var a, o;
    (o = (a = this.handler).onParseError) === null || o === void 0 || o.call(a, this.preprocessor.getError(e, t));
  }
  getCurrentLocation(e) {
    return this.options.sourceCodeLocationInfo ? {
      startLine: this.preprocessor.line,
      startCol: this.preprocessor.col - e,
      startOffset: this.preprocessor.offset - e,
      endLine: -1,
      endCol: -1,
      endOffset: -1
    } : null;
  }
  _runParsingLoop() {
    if (!this.inLoop) {
      for (this.inLoop = !0; this.active && !this.paused; ) {
        this.consumedAfterSnapshot = 0;
        const e = this._consume();
        this._ensureHibernation() || this._callState(e);
      }
      this.inLoop = !1;
    }
  }
  pause() {
    this.paused = !0;
  }
  resume(e) {
    if (!this.paused) throw new Error("Parser was already resumed");
    this.paused = !1, !this.inLoop && (this._runParsingLoop(), this.paused || e?.());
  }
  write(e, t, a) {
    this.active = !0, this.preprocessor.write(e, t), this._runParsingLoop(), this.paused || a?.();
  }
  insertHtmlAtCurrentPos(e) {
    this.active = !0, this.preprocessor.insertHtmlAtCurrentPos(e), this._runParsingLoop();
  }
  _ensureHibernation() {
    return this.preprocessor.endOfChunkHit ? (this.preprocessor.retreat(this.consumedAfterSnapshot), this.consumedAfterSnapshot = 0, this.active = !1, !0) : !1;
  }
  _consume() {
    return this.consumedAfterSnapshot++, this.preprocessor.advance();
  }
  _advanceBy(e) {
    this.consumedAfterSnapshot += e;
    for (let t = 0; t < e; t++) this.preprocessor.advance();
  }
  _consumeSequenceIfMatch(e, t) {
    return this.preprocessor.startsWith(e, t) ? (this._advanceBy(e.length - 1), !0) : !1;
  }
  _createStartTagToken() {
    this.currentToken = {
      type: d.START_TAG,
      tagName: "",
      tagID: s.UNKNOWN,
      selfClosing: !1,
      ackSelfClosing: !1,
      attrs: [],
      location: this.getCurrentLocation(1)
    };
  }
  _createEndTagToken() {
    this.currentToken = {
      type: d.END_TAG,
      tagName: "",
      tagID: s.UNKNOWN,
      selfClosing: !1,
      ackSelfClosing: !1,
      attrs: [],
      location: this.getCurrentLocation(2)
    };
  }
  _createCommentToken(e) {
    this.currentToken = {
      type: d.COMMENT,
      data: "",
      location: this.getCurrentLocation(e)
    };
  }
  _createDoctypeToken(e) {
    this.currentToken = {
      type: d.DOCTYPE,
      name: e,
      forceQuirks: !1,
      publicId: null,
      systemId: null,
      location: this.currentLocation
    };
  }
  _createCharacterToken(e, t) {
    this.currentCharacterToken = {
      type: e,
      chars: t,
      location: this.currentLocation
    };
  }
  _createAttr(e) {
    this.currentAttr = {
      name: e,
      value: ""
    }, this.currentLocation = this.getCurrentLocation(0);
  }
  _leaveAttrName() {
    var e, t;
    const a = this.currentToken;
    if (Re(a, this.currentAttr.name) === null) {
      if (a.attrs.push(this.currentAttr), a.location && this.currentLocation) {
        const o = (e = (t = a.location).attrs) !== null && e !== void 0 ? e : t.attrs = /* @__PURE__ */ Object.create(null);
        o[this.currentAttr.name] = this.currentLocation, this._leaveAttrValue();
      }
    } else this._err(E.duplicateAttribute);
  }
  _leaveAttrValue() {
    this.currentLocation && (this.currentLocation.endLine = this.preprocessor.line, this.currentLocation.endCol = this.preprocessor.col, this.currentLocation.endOffset = this.preprocessor.offset);
  }
  prepareToken(e) {
    this._emitCurrentCharacterToken(e.location), this.currentToken = null, e.location && (e.location.endLine = this.preprocessor.line, e.location.endCol = this.preprocessor.col + 1, e.location.endOffset = this.preprocessor.offset + 1), this.currentLocation = this.getCurrentLocation(-1);
  }
  emitCurrentTagToken() {
    const e = this.currentToken;
    this.prepareToken(e), e.tagID = J(e.tagName), e.type === d.START_TAG ? (this.lastStartTagName = e.tagName, this.handler.onStartTag(e)) : (e.attrs.length > 0 && this._err(E.endTagWithAttributes), e.selfClosing && this._err(E.endTagWithTrailingSolidus), this.handler.onEndTag(e)), this.preprocessor.dropParsedChunk();
  }
  emitCurrentComment(e) {
    this.prepareToken(e), this.handler.onComment(e), this.preprocessor.dropParsedChunk();
  }
  emitCurrentDoctype(e) {
    this.prepareToken(e), this.handler.onDoctype(e), this.preprocessor.dropParsedChunk();
  }
  _emitCurrentCharacterToken(e) {
    if (this.currentCharacterToken) {
      switch (e && this.currentCharacterToken.location && (this.currentCharacterToken.location.endLine = e.startLine, this.currentCharacterToken.location.endCol = e.startCol, this.currentCharacterToken.location.endOffset = e.startOffset), this.currentCharacterToken.type) {
        case d.CHARACTER:
          this.handler.onCharacter(this.currentCharacterToken);
          break;
        case d.NULL_CHARACTER:
          this.handler.onNullCharacter(this.currentCharacterToken);
          break;
        case d.WHITESPACE_CHARACTER:
          this.handler.onWhitespaceCharacter(this.currentCharacterToken);
          break;
      }
      this.currentCharacterToken = null;
    }
  }
  _emitEOFToken() {
    const e = this.getCurrentLocation(0);
    e && (e.endLine = e.startLine, e.endCol = e.startCol, e.endOffset = e.startOffset), this._emitCurrentCharacterToken(e), this.handler.onEof({
      type: d.EOF,
      location: e
    }), this.active = !1;
  }
  _appendCharToCurrentCharacterToken(e, t) {
    if (this.currentCharacterToken) if (this.currentCharacterToken.type === e) {
      this.currentCharacterToken.chars += t;
      return;
    } else
      this.currentLocation = this.getCurrentLocation(0), this._emitCurrentCharacterToken(this.currentLocation), this.preprocessor.dropParsedChunk();
    this._createCharacterToken(e, t);
  }
  _emitCodePoint(e) {
    const t = De(e) ? d.WHITESPACE_CHARACTER : e === r.NULL ? d.NULL_CHARACTER : d.CHARACTER;
    this._appendCharToCurrentCharacterToken(t, String.fromCodePoint(e));
  }
  _emitChars(e) {
    this._appendCharToCurrentCharacterToken(d.CHARACTER, e);
  }
  _startCharacterReference() {
    this.returnState = this.state, this.state = i.CHARACTER_REFERENCE, this.entityStartPos = this.preprocessor.pos, this.entityDecoder.startEntity(this._isCharacterReferenceInAttribute() ? p.Attribute : p.Legacy);
  }
  _isCharacterReferenceInAttribute() {
    return this.returnState === i.ATTRIBUTE_VALUE_DOUBLE_QUOTED || this.returnState === i.ATTRIBUTE_VALUE_SINGLE_QUOTED || this.returnState === i.ATTRIBUTE_VALUE_UNQUOTED;
  }
  _flushCodePointConsumedAsCharacterReference(e) {
    this._isCharacterReferenceInAttribute() ? this.currentAttr.value += String.fromCodePoint(e) : this._emitCodePoint(e);
  }
  _callState(e) {
    switch (this.state) {
      case i.DATA:
        this._stateData(e);
        break;
      case i.RCDATA:
        this._stateRcdata(e);
        break;
      case i.RAWTEXT:
        this._stateRawtext(e);
        break;
      case i.SCRIPT_DATA:
        this._stateScriptData(e);
        break;
      case i.PLAINTEXT:
        this._statePlaintext(e);
        break;
      case i.TAG_OPEN:
        this._stateTagOpen(e);
        break;
      case i.END_TAG_OPEN:
        this._stateEndTagOpen(e);
        break;
      case i.TAG_NAME:
        this._stateTagName(e);
        break;
      case i.RCDATA_LESS_THAN_SIGN:
        this._stateRcdataLessThanSign(e);
        break;
      case i.RCDATA_END_TAG_OPEN:
        this._stateRcdataEndTagOpen(e);
        break;
      case i.RCDATA_END_TAG_NAME:
        this._stateRcdataEndTagName(e);
        break;
      case i.RAWTEXT_LESS_THAN_SIGN:
        this._stateRawtextLessThanSign(e);
        break;
      case i.RAWTEXT_END_TAG_OPEN:
        this._stateRawtextEndTagOpen(e);
        break;
      case i.RAWTEXT_END_TAG_NAME:
        this._stateRawtextEndTagName(e);
        break;
      case i.SCRIPT_DATA_LESS_THAN_SIGN:
        this._stateScriptDataLessThanSign(e);
        break;
      case i.SCRIPT_DATA_END_TAG_OPEN:
        this._stateScriptDataEndTagOpen(e);
        break;
      case i.SCRIPT_DATA_END_TAG_NAME:
        this._stateScriptDataEndTagName(e);
        break;
      case i.SCRIPT_DATA_ESCAPE_START:
        this._stateScriptDataEscapeStart(e);
        break;
      case i.SCRIPT_DATA_ESCAPE_START_DASH:
        this._stateScriptDataEscapeStartDash(e);
        break;
      case i.SCRIPT_DATA_ESCAPED:
        this._stateScriptDataEscaped(e);
        break;
      case i.SCRIPT_DATA_ESCAPED_DASH:
        this._stateScriptDataEscapedDash(e);
        break;
      case i.SCRIPT_DATA_ESCAPED_DASH_DASH:
        this._stateScriptDataEscapedDashDash(e);
        break;
      case i.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN:
        this._stateScriptDataEscapedLessThanSign(e);
        break;
      case i.SCRIPT_DATA_ESCAPED_END_TAG_OPEN:
        this._stateScriptDataEscapedEndTagOpen(e);
        break;
      case i.SCRIPT_DATA_ESCAPED_END_TAG_NAME:
        this._stateScriptDataEscapedEndTagName(e);
        break;
      case i.SCRIPT_DATA_DOUBLE_ESCAPE_START:
        this._stateScriptDataDoubleEscapeStart(e);
        break;
      case i.SCRIPT_DATA_DOUBLE_ESCAPED:
        this._stateScriptDataDoubleEscaped(e);
        break;
      case i.SCRIPT_DATA_DOUBLE_ESCAPED_DASH:
        this._stateScriptDataDoubleEscapedDash(e);
        break;
      case i.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH:
        this._stateScriptDataDoubleEscapedDashDash(e);
        break;
      case i.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN:
        this._stateScriptDataDoubleEscapedLessThanSign(e);
        break;
      case i.SCRIPT_DATA_DOUBLE_ESCAPE_END:
        this._stateScriptDataDoubleEscapeEnd(e);
        break;
      case i.BEFORE_ATTRIBUTE_NAME:
        this._stateBeforeAttributeName(e);
        break;
      case i.ATTRIBUTE_NAME:
        this._stateAttributeName(e);
        break;
      case i.AFTER_ATTRIBUTE_NAME:
        this._stateAfterAttributeName(e);
        break;
      case i.BEFORE_ATTRIBUTE_VALUE:
        this._stateBeforeAttributeValue(e);
        break;
      case i.ATTRIBUTE_VALUE_DOUBLE_QUOTED:
        this._stateAttributeValueDoubleQuoted(e);
        break;
      case i.ATTRIBUTE_VALUE_SINGLE_QUOTED:
        this._stateAttributeValueSingleQuoted(e);
        break;
      case i.ATTRIBUTE_VALUE_UNQUOTED:
        this._stateAttributeValueUnquoted(e);
        break;
      case i.AFTER_ATTRIBUTE_VALUE_QUOTED:
        this._stateAfterAttributeValueQuoted(e);
        break;
      case i.SELF_CLOSING_START_TAG:
        this._stateSelfClosingStartTag(e);
        break;
      case i.BOGUS_COMMENT:
        this._stateBogusComment(e);
        break;
      case i.MARKUP_DECLARATION_OPEN:
        this._stateMarkupDeclarationOpen(e);
        break;
      case i.COMMENT_START:
        this._stateCommentStart(e);
        break;
      case i.COMMENT_START_DASH:
        this._stateCommentStartDash(e);
        break;
      case i.COMMENT:
        this._stateComment(e);
        break;
      case i.COMMENT_LESS_THAN_SIGN:
        this._stateCommentLessThanSign(e);
        break;
      case i.COMMENT_LESS_THAN_SIGN_BANG:
        this._stateCommentLessThanSignBang(e);
        break;
      case i.COMMENT_LESS_THAN_SIGN_BANG_DASH:
        this._stateCommentLessThanSignBangDash(e);
        break;
      case i.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH:
        this._stateCommentLessThanSignBangDashDash(e);
        break;
      case i.COMMENT_END_DASH:
        this._stateCommentEndDash(e);
        break;
      case i.COMMENT_END:
        this._stateCommentEnd(e);
        break;
      case i.COMMENT_END_BANG:
        this._stateCommentEndBang(e);
        break;
      case i.DOCTYPE:
        this._stateDoctype(e);
        break;
      case i.BEFORE_DOCTYPE_NAME:
        this._stateBeforeDoctypeName(e);
        break;
      case i.DOCTYPE_NAME:
        this._stateDoctypeName(e);
        break;
      case i.AFTER_DOCTYPE_NAME:
        this._stateAfterDoctypeName(e);
        break;
      case i.AFTER_DOCTYPE_PUBLIC_KEYWORD:
        this._stateAfterDoctypePublicKeyword(e);
        break;
      case i.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER:
        this._stateBeforeDoctypePublicIdentifier(e);
        break;
      case i.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED:
        this._stateDoctypePublicIdentifierDoubleQuoted(e);
        break;
      case i.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED:
        this._stateDoctypePublicIdentifierSingleQuoted(e);
        break;
      case i.AFTER_DOCTYPE_PUBLIC_IDENTIFIER:
        this._stateAfterDoctypePublicIdentifier(e);
        break;
      case i.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS:
        this._stateBetweenDoctypePublicAndSystemIdentifiers(e);
        break;
      case i.AFTER_DOCTYPE_SYSTEM_KEYWORD:
        this._stateAfterDoctypeSystemKeyword(e);
        break;
      case i.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER:
        this._stateBeforeDoctypeSystemIdentifier(e);
        break;
      case i.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED:
        this._stateDoctypeSystemIdentifierDoubleQuoted(e);
        break;
      case i.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED:
        this._stateDoctypeSystemIdentifierSingleQuoted(e);
        break;
      case i.AFTER_DOCTYPE_SYSTEM_IDENTIFIER:
        this._stateAfterDoctypeSystemIdentifier(e);
        break;
      case i.BOGUS_DOCTYPE:
        this._stateBogusDoctype(e);
        break;
      case i.CDATA_SECTION:
        this._stateCdataSection(e);
        break;
      case i.CDATA_SECTION_BRACKET:
        this._stateCdataSectionBracket(e);
        break;
      case i.CDATA_SECTION_END:
        this._stateCdataSectionEnd(e);
        break;
      case i.CHARACTER_REFERENCE:
        this._stateCharacterReference();
        break;
      case i.AMBIGUOUS_AMPERSAND:
        this._stateAmbiguousAmpersand(e);
        break;
      default:
        throw new Error("Unknown state");
    }
  }
  _stateData(e) {
    switch (e) {
      case r.LESS_THAN_SIGN:
        this.state = i.TAG_OPEN;
        break;
      case r.AMPERSAND:
        this._startCharacterReference();
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitCodePoint(e);
        break;
      case r.EOF:
        this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateRcdata(e) {
    switch (e) {
      case r.AMPERSAND:
        this._startCharacterReference();
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.RCDATA_LESS_THAN_SIGN;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitChars(u);
        break;
      case r.EOF:
        this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateRawtext(e) {
    switch (e) {
      case r.LESS_THAN_SIGN:
        this.state = i.RAWTEXT_LESS_THAN_SIGN;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitChars(u);
        break;
      case r.EOF:
        this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateScriptData(e) {
    switch (e) {
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_LESS_THAN_SIGN;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitChars(u);
        break;
      case r.EOF:
        this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _statePlaintext(e) {
    switch (e) {
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitChars(u);
        break;
      case r.EOF:
        this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateTagOpen(e) {
    if (g(e))
      this._createStartTagToken(), this.state = i.TAG_NAME, this._stateTagName(e);
    else switch (e) {
      case r.EXCLAMATION_MARK:
        this.state = i.MARKUP_DECLARATION_OPEN;
        break;
      case r.SOLIDUS:
        this.state = i.END_TAG_OPEN;
        break;
      case r.QUESTION_MARK:
        this._err(E.unexpectedQuestionMarkInsteadOfTagName), this._createCommentToken(1), this.state = i.BOGUS_COMMENT, this._stateBogusComment(e);
        break;
      case r.EOF:
        this._err(E.eofBeforeTagName), this._emitChars("<"), this._emitEOFToken();
        break;
      default:
        this._err(E.invalidFirstCharacterOfTagName), this._emitChars("<"), this.state = i.DATA, this._stateData(e);
    }
  }
  _stateEndTagOpen(e) {
    if (g(e))
      this._createEndTagToken(), this.state = i.TAG_NAME, this._stateTagName(e);
    else switch (e) {
      case r.GREATER_THAN_SIGN:
        this._err(E.missingEndTagName), this.state = i.DATA;
        break;
      case r.EOF:
        this._err(E.eofBeforeTagName), this._emitChars("</"), this._emitEOFToken();
        break;
      default:
        this._err(E.invalidFirstCharacterOfTagName), this._createCommentToken(2), this.state = i.BOGUS_COMMENT, this._stateBogusComment(e);
    }
  }
  _stateTagName(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this.state = i.BEFORE_ATTRIBUTE_NAME;
        break;
      case r.SOLIDUS:
        this.state = i.SELF_CLOSING_START_TAG;
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentTagToken();
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.tagName += u;
        break;
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        t.tagName += String.fromCodePoint(y(e) ? q(e) : e);
    }
  }
  _stateRcdataLessThanSign(e) {
    e === r.SOLIDUS ? this.state = i.RCDATA_END_TAG_OPEN : (this._emitChars("<"), this.state = i.RCDATA, this._stateRcdata(e));
  }
  _stateRcdataEndTagOpen(e) {
    g(e) ? (this.state = i.RCDATA_END_TAG_NAME, this._stateRcdataEndTagName(e)) : (this._emitChars("</"), this.state = i.RCDATA, this._stateRcdata(e));
  }
  handleSpecialEndTag(e) {
    if (!this.preprocessor.startsWith(this.lastStartTagName, !1)) return !this._ensureHibernation();
    this._createEndTagToken();
    const t = this.currentToken;
    switch (t.tagName = this.lastStartTagName, this.preprocessor.peek(this.lastStartTagName.length)) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        return this._advanceBy(this.lastStartTagName.length), this.state = i.BEFORE_ATTRIBUTE_NAME, !1;
      case r.SOLIDUS:
        return this._advanceBy(this.lastStartTagName.length), this.state = i.SELF_CLOSING_START_TAG, !1;
      case r.GREATER_THAN_SIGN:
        return this._advanceBy(this.lastStartTagName.length), this.emitCurrentTagToken(), this.state = i.DATA, !1;
      default:
        return !this._ensureHibernation();
    }
  }
  _stateRcdataEndTagName(e) {
    this.handleSpecialEndTag(e) && (this._emitChars("</"), this.state = i.RCDATA, this._stateRcdata(e));
  }
  _stateRawtextLessThanSign(e) {
    e === r.SOLIDUS ? this.state = i.RAWTEXT_END_TAG_OPEN : (this._emitChars("<"), this.state = i.RAWTEXT, this._stateRawtext(e));
  }
  _stateRawtextEndTagOpen(e) {
    g(e) ? (this.state = i.RAWTEXT_END_TAG_NAME, this._stateRawtextEndTagName(e)) : (this._emitChars("</"), this.state = i.RAWTEXT, this._stateRawtext(e));
  }
  _stateRawtextEndTagName(e) {
    this.handleSpecialEndTag(e) && (this._emitChars("</"), this.state = i.RAWTEXT, this._stateRawtext(e));
  }
  _stateScriptDataLessThanSign(e) {
    switch (e) {
      case r.SOLIDUS:
        this.state = i.SCRIPT_DATA_END_TAG_OPEN;
        break;
      case r.EXCLAMATION_MARK:
        this.state = i.SCRIPT_DATA_ESCAPE_START, this._emitChars("<!");
        break;
      default:
        this._emitChars("<"), this.state = i.SCRIPT_DATA, this._stateScriptData(e);
    }
  }
  _stateScriptDataEndTagOpen(e) {
    g(e) ? (this.state = i.SCRIPT_DATA_END_TAG_NAME, this._stateScriptDataEndTagName(e)) : (this._emitChars("</"), this.state = i.SCRIPT_DATA, this._stateScriptData(e));
  }
  _stateScriptDataEndTagName(e) {
    this.handleSpecialEndTag(e) && (this._emitChars("</"), this.state = i.SCRIPT_DATA, this._stateScriptData(e));
  }
  _stateScriptDataEscapeStart(e) {
    e === r.HYPHEN_MINUS ? (this.state = i.SCRIPT_DATA_ESCAPE_START_DASH, this._emitChars("-")) : (this.state = i.SCRIPT_DATA, this._stateScriptData(e));
  }
  _stateScriptDataEscapeStartDash(e) {
    e === r.HYPHEN_MINUS ? (this.state = i.SCRIPT_DATA_ESCAPED_DASH_DASH, this._emitChars("-")) : (this.state = i.SCRIPT_DATA, this._stateScriptData(e));
  }
  _stateScriptDataEscaped(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.SCRIPT_DATA_ESCAPED_DASH, this._emitChars("-");
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitChars(u);
        break;
      case r.EOF:
        this._err(E.eofInScriptHtmlCommentLikeText), this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateScriptDataEscapedDash(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.SCRIPT_DATA_ESCAPED_DASH_DASH, this._emitChars("-");
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.state = i.SCRIPT_DATA_ESCAPED, this._emitChars(u);
        break;
      case r.EOF:
        this._err(E.eofInScriptHtmlCommentLikeText), this._emitEOFToken();
        break;
      default:
        this.state = i.SCRIPT_DATA_ESCAPED, this._emitCodePoint(e);
    }
  }
  _stateScriptDataEscapedDashDash(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this._emitChars("-");
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.SCRIPT_DATA, this._emitChars(">");
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.state = i.SCRIPT_DATA_ESCAPED, this._emitChars(u);
        break;
      case r.EOF:
        this._err(E.eofInScriptHtmlCommentLikeText), this._emitEOFToken();
        break;
      default:
        this.state = i.SCRIPT_DATA_ESCAPED, this._emitCodePoint(e);
    }
  }
  _stateScriptDataEscapedLessThanSign(e) {
    e === r.SOLIDUS ? this.state = i.SCRIPT_DATA_ESCAPED_END_TAG_OPEN : g(e) ? (this._emitChars("<"), this.state = i.SCRIPT_DATA_DOUBLE_ESCAPE_START, this._stateScriptDataDoubleEscapeStart(e)) : (this._emitChars("<"), this.state = i.SCRIPT_DATA_ESCAPED, this._stateScriptDataEscaped(e));
  }
  _stateScriptDataEscapedEndTagOpen(e) {
    g(e) ? (this.state = i.SCRIPT_DATA_ESCAPED_END_TAG_NAME, this._stateScriptDataEscapedEndTagName(e)) : (this._emitChars("</"), this.state = i.SCRIPT_DATA_ESCAPED, this._stateScriptDataEscaped(e));
  }
  _stateScriptDataEscapedEndTagName(e) {
    this.handleSpecialEndTag(e) && (this._emitChars("</"), this.state = i.SCRIPT_DATA_ESCAPED, this._stateScriptDataEscaped(e));
  }
  _stateScriptDataDoubleEscapeStart(e) {
    if (this.preprocessor.startsWith(O.SCRIPT, !1) && le(this.preprocessor.peek(O.SCRIPT.length))) {
      this._emitCodePoint(e);
      for (let t = 0; t < O.SCRIPT.length; t++) this._emitCodePoint(this._consume());
      this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED;
    } else this._ensureHibernation() || (this.state = i.SCRIPT_DATA_ESCAPED, this._stateScriptDataEscaped(e));
  }
  _stateScriptDataDoubleEscaped(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED_DASH, this._emitChars("-");
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN, this._emitChars("<");
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._emitChars(u);
        break;
      case r.EOF:
        this._err(E.eofInScriptHtmlCommentLikeText), this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateScriptDataDoubleEscapedDash(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH, this._emitChars("-");
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN, this._emitChars("<");
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED, this._emitChars(u);
        break;
      case r.EOF:
        this._err(E.eofInScriptHtmlCommentLikeText), this._emitEOFToken();
        break;
      default:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED, this._emitCodePoint(e);
    }
  }
  _stateScriptDataDoubleEscapedDashDash(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this._emitChars("-");
        break;
      case r.LESS_THAN_SIGN:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN, this._emitChars("<");
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.SCRIPT_DATA, this._emitChars(">");
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED, this._emitChars(u);
        break;
      case r.EOF:
        this._err(E.eofInScriptHtmlCommentLikeText), this._emitEOFToken();
        break;
      default:
        this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED, this._emitCodePoint(e);
    }
  }
  _stateScriptDataDoubleEscapedLessThanSign(e) {
    e === r.SOLIDUS ? (this.state = i.SCRIPT_DATA_DOUBLE_ESCAPE_END, this._emitChars("/")) : (this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED, this._stateScriptDataDoubleEscaped(e));
  }
  _stateScriptDataDoubleEscapeEnd(e) {
    if (this.preprocessor.startsWith(O.SCRIPT, !1) && le(this.preprocessor.peek(O.SCRIPT.length))) {
      this._emitCodePoint(e);
      for (let t = 0; t < O.SCRIPT.length; t++) this._emitCodePoint(this._consume());
      this.state = i.SCRIPT_DATA_ESCAPED;
    } else this._ensureHibernation() || (this.state = i.SCRIPT_DATA_DOUBLE_ESCAPED, this._stateScriptDataDoubleEscaped(e));
  }
  _stateBeforeAttributeName(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.SOLIDUS:
      case r.GREATER_THAN_SIGN:
      case r.EOF:
        this.state = i.AFTER_ATTRIBUTE_NAME, this._stateAfterAttributeName(e);
        break;
      case r.EQUALS_SIGN:
        this._err(E.unexpectedEqualsSignBeforeAttributeName), this._createAttr("="), this.state = i.ATTRIBUTE_NAME;
        break;
      default:
        this._createAttr(""), this.state = i.ATTRIBUTE_NAME, this._stateAttributeName(e);
    }
  }
  _stateAttributeName(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
      case r.SOLIDUS:
      case r.GREATER_THAN_SIGN:
      case r.EOF:
        this._leaveAttrName(), this.state = i.AFTER_ATTRIBUTE_NAME, this._stateAfterAttributeName(e);
        break;
      case r.EQUALS_SIGN:
        this._leaveAttrName(), this.state = i.BEFORE_ATTRIBUTE_VALUE;
        break;
      case r.QUOTATION_MARK:
      case r.APOSTROPHE:
      case r.LESS_THAN_SIGN:
        this._err(E.unexpectedCharacterInAttributeName), this.currentAttr.name += String.fromCodePoint(e);
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.currentAttr.name += u;
        break;
      default:
        this.currentAttr.name += String.fromCodePoint(y(e) ? q(e) : e);
    }
  }
  _stateAfterAttributeName(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.SOLIDUS:
        this.state = i.SELF_CLOSING_START_TAG;
        break;
      case r.EQUALS_SIGN:
        this.state = i.BEFORE_ATTRIBUTE_VALUE;
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentTagToken();
        break;
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        this._createAttr(""), this.state = i.ATTRIBUTE_NAME, this._stateAttributeName(e);
    }
  }
  _stateBeforeAttributeValue(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.QUOTATION_MARK:
        this.state = i.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        this.state = i.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.missingAttributeValue), this.state = i.DATA, this.emitCurrentTagToken();
        break;
      default:
        this.state = i.ATTRIBUTE_VALUE_UNQUOTED, this._stateAttributeValueUnquoted(e);
    }
  }
  _stateAttributeValueDoubleQuoted(e) {
    switch (e) {
      case r.QUOTATION_MARK:
        this.state = i.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      case r.AMPERSAND:
        this._startCharacterReference();
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.currentAttr.value += u;
        break;
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        this.currentAttr.value += String.fromCodePoint(e);
    }
  }
  _stateAttributeValueSingleQuoted(e) {
    switch (e) {
      case r.APOSTROPHE:
        this.state = i.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      case r.AMPERSAND:
        this._startCharacterReference();
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.currentAttr.value += u;
        break;
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        this.currentAttr.value += String.fromCodePoint(e);
    }
  }
  _stateAttributeValueUnquoted(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this._leaveAttrValue(), this.state = i.BEFORE_ATTRIBUTE_NAME;
        break;
      case r.AMPERSAND:
        this._startCharacterReference();
        break;
      case r.GREATER_THAN_SIGN:
        this._leaveAttrValue(), this.state = i.DATA, this.emitCurrentTagToken();
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this.currentAttr.value += u;
        break;
      case r.QUOTATION_MARK:
      case r.APOSTROPHE:
      case r.LESS_THAN_SIGN:
      case r.EQUALS_SIGN:
      case r.GRAVE_ACCENT:
        this._err(E.unexpectedCharacterInUnquotedAttributeValue), this.currentAttr.value += String.fromCodePoint(e);
        break;
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        this.currentAttr.value += String.fromCodePoint(e);
    }
  }
  _stateAfterAttributeValueQuoted(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this._leaveAttrValue(), this.state = i.BEFORE_ATTRIBUTE_NAME;
        break;
      case r.SOLIDUS:
        this._leaveAttrValue(), this.state = i.SELF_CLOSING_START_TAG;
        break;
      case r.GREATER_THAN_SIGN:
        this._leaveAttrValue(), this.state = i.DATA, this.emitCurrentTagToken();
        break;
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        this._err(E.missingWhitespaceBetweenAttributes), this.state = i.BEFORE_ATTRIBUTE_NAME, this._stateBeforeAttributeName(e);
    }
  }
  _stateSelfClosingStartTag(e) {
    switch (e) {
      case r.GREATER_THAN_SIGN: {
        const t = this.currentToken;
        t.selfClosing = !0, this.state = i.DATA, this.emitCurrentTagToken();
        break;
      }
      case r.EOF:
        this._err(E.eofInTag), this._emitEOFToken();
        break;
      default:
        this._err(E.unexpectedSolidusInTag), this.state = i.BEFORE_ATTRIBUTE_NAME, this._stateBeforeAttributeName(e);
    }
  }
  _stateBogusComment(e) {
    const t = this.currentToken;
    switch (e) {
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentComment(t);
        break;
      case r.EOF:
        this.emitCurrentComment(t), this._emitEOFToken();
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.data += u;
        break;
      default:
        t.data += String.fromCodePoint(e);
    }
  }
  _stateMarkupDeclarationOpen(e) {
    this._consumeSequenceIfMatch(O.DASH_DASH, !0) ? (this._createCommentToken(O.DASH_DASH.length + 1), this.state = i.COMMENT_START) : this._consumeSequenceIfMatch(O.DOCTYPE, !1) ? (this.currentLocation = this.getCurrentLocation(O.DOCTYPE.length + 1), this.state = i.DOCTYPE) : this._consumeSequenceIfMatch(O.CDATA_START, !0) ? this.inForeignNode ? this.state = i.CDATA_SECTION : (this._err(E.cdataInHtmlContent), this._createCommentToken(O.CDATA_START.length + 1), this.currentToken.data = "[CDATA[", this.state = i.BOGUS_COMMENT) : this._ensureHibernation() || (this._err(E.incorrectlyOpenedComment), this._createCommentToken(2), this.state = i.BOGUS_COMMENT, this._stateBogusComment(e));
  }
  _stateCommentStart(e) {
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.COMMENT_START_DASH;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.abruptClosingOfEmptyComment), this.state = i.DATA, this.emitCurrentComment(this.currentToken);
        break;
      default:
        this.state = i.COMMENT, this._stateComment(e);
    }
  }
  _stateCommentStartDash(e) {
    const t = this.currentToken;
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.COMMENT_END;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.abruptClosingOfEmptyComment), this.state = i.DATA, this.emitCurrentComment(t);
        break;
      case r.EOF:
        this._err(E.eofInComment), this.emitCurrentComment(t), this._emitEOFToken();
        break;
      default:
        t.data += "-", this.state = i.COMMENT, this._stateComment(e);
    }
  }
  _stateComment(e) {
    const t = this.currentToken;
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.COMMENT_END_DASH;
        break;
      case r.LESS_THAN_SIGN:
        t.data += "<", this.state = i.COMMENT_LESS_THAN_SIGN;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.data += u;
        break;
      case r.EOF:
        this._err(E.eofInComment), this.emitCurrentComment(t), this._emitEOFToken();
        break;
      default:
        t.data += String.fromCodePoint(e);
    }
  }
  _stateCommentLessThanSign(e) {
    const t = this.currentToken;
    switch (e) {
      case r.EXCLAMATION_MARK:
        t.data += "!", this.state = i.COMMENT_LESS_THAN_SIGN_BANG;
        break;
      case r.LESS_THAN_SIGN:
        t.data += "<";
        break;
      default:
        this.state = i.COMMENT, this._stateComment(e);
    }
  }
  _stateCommentLessThanSignBang(e) {
    e === r.HYPHEN_MINUS ? this.state = i.COMMENT_LESS_THAN_SIGN_BANG_DASH : (this.state = i.COMMENT, this._stateComment(e));
  }
  _stateCommentLessThanSignBangDash(e) {
    e === r.HYPHEN_MINUS ? this.state = i.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH : (this.state = i.COMMENT_END_DASH, this._stateCommentEndDash(e));
  }
  _stateCommentLessThanSignBangDashDash(e) {
    e !== r.GREATER_THAN_SIGN && e !== r.EOF && this._err(E.nestedComment), this.state = i.COMMENT_END, this._stateCommentEnd(e);
  }
  _stateCommentEndDash(e) {
    const t = this.currentToken;
    switch (e) {
      case r.HYPHEN_MINUS:
        this.state = i.COMMENT_END;
        break;
      case r.EOF:
        this._err(E.eofInComment), this.emitCurrentComment(t), this._emitEOFToken();
        break;
      default:
        t.data += "-", this.state = i.COMMENT, this._stateComment(e);
    }
  }
  _stateCommentEnd(e) {
    const t = this.currentToken;
    switch (e) {
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentComment(t);
        break;
      case r.EXCLAMATION_MARK:
        this.state = i.COMMENT_END_BANG;
        break;
      case r.HYPHEN_MINUS:
        t.data += "-";
        break;
      case r.EOF:
        this._err(E.eofInComment), this.emitCurrentComment(t), this._emitEOFToken();
        break;
      default:
        t.data += "--", this.state = i.COMMENT, this._stateComment(e);
    }
  }
  _stateCommentEndBang(e) {
    const t = this.currentToken;
    switch (e) {
      case r.HYPHEN_MINUS:
        t.data += "--!", this.state = i.COMMENT_END_DASH;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.incorrectlyClosedComment), this.state = i.DATA, this.emitCurrentComment(t);
        break;
      case r.EOF:
        this._err(E.eofInComment), this.emitCurrentComment(t), this._emitEOFToken();
        break;
      default:
        t.data += "--!", this.state = i.COMMENT, this._stateComment(e);
    }
  }
  _stateDoctype(e) {
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this.state = i.BEFORE_DOCTYPE_NAME;
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.BEFORE_DOCTYPE_NAME, this._stateBeforeDoctypeName(e);
        break;
      case r.EOF: {
        this._err(E.eofInDoctype), this._createDoctypeToken(null);
        const t = this.currentToken;
        t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      }
      default:
        this._err(E.missingWhitespaceBeforeDoctypeName), this.state = i.BEFORE_DOCTYPE_NAME, this._stateBeforeDoctypeName(e);
    }
  }
  _stateBeforeDoctypeName(e) {
    if (y(e))
      this._createDoctypeToken(String.fromCharCode(q(e))), this.state = i.DOCTYPE_NAME;
    else switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), this._createDoctypeToken(u), this.state = i.DOCTYPE_NAME;
        break;
      case r.GREATER_THAN_SIGN: {
        this._err(E.missingDoctypeName), this._createDoctypeToken(null);
        const t = this.currentToken;
        t.forceQuirks = !0, this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      }
      case r.EOF: {
        this._err(E.eofInDoctype), this._createDoctypeToken(null);
        const t = this.currentToken;
        t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      }
      default:
        this._createDoctypeToken(String.fromCodePoint(e)), this.state = i.DOCTYPE_NAME;
    }
  }
  _stateDoctypeName(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this.state = i.AFTER_DOCTYPE_NAME;
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.name += u;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        t.name += String.fromCodePoint(y(e) ? q(e) : e);
    }
  }
  _stateAfterDoctypeName(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._consumeSequenceIfMatch(O.PUBLIC, !1) ? this.state = i.AFTER_DOCTYPE_PUBLIC_KEYWORD : this._consumeSequenceIfMatch(O.SYSTEM, !1) ? this.state = i.AFTER_DOCTYPE_SYSTEM_KEYWORD : this._ensureHibernation() || (this._err(E.invalidCharacterSequenceAfterDoctypeName), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e));
    }
  }
  _stateAfterDoctypePublicKeyword(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this.state = i.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      case r.QUOTATION_MARK:
        this._err(E.missingWhitespaceAfterDoctypePublicKeyword), t.publicId = "", this.state = i.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        this._err(E.missingWhitespaceAfterDoctypePublicKeyword), t.publicId = "", this.state = i.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.missingDoctypePublicIdentifier), t.forceQuirks = !0, this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.missingQuoteBeforeDoctypePublicIdentifier), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateBeforeDoctypePublicIdentifier(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.QUOTATION_MARK:
        t.publicId = "", this.state = i.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        t.publicId = "", this.state = i.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.missingDoctypePublicIdentifier), t.forceQuirks = !0, this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.missingQuoteBeforeDoctypePublicIdentifier), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateDoctypePublicIdentifierDoubleQuoted(e) {
    const t = this.currentToken;
    switch (e) {
      case r.QUOTATION_MARK:
        this.state = i.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.publicId += u;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.abruptDoctypePublicIdentifier), t.forceQuirks = !0, this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        t.publicId += String.fromCodePoint(e);
    }
  }
  _stateDoctypePublicIdentifierSingleQuoted(e) {
    const t = this.currentToken;
    switch (e) {
      case r.APOSTROPHE:
        this.state = i.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.publicId += u;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.abruptDoctypePublicIdentifier), t.forceQuirks = !0, this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        t.publicId += String.fromCodePoint(e);
    }
  }
  _stateAfterDoctypePublicIdentifier(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this.state = i.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
        break;
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.QUOTATION_MARK:
        this._err(E.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers), t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        this._err(E.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers), t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.missingQuoteBeforeDoctypeSystemIdentifier), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateBetweenDoctypePublicAndSystemIdentifiers(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.GREATER_THAN_SIGN:
        this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.QUOTATION_MARK:
        t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.missingQuoteBeforeDoctypeSystemIdentifier), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateAfterDoctypeSystemKeyword(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        this.state = i.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      case r.QUOTATION_MARK:
        this._err(E.missingWhitespaceAfterDoctypeSystemKeyword), t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        this._err(E.missingWhitespaceAfterDoctypeSystemKeyword), t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.missingDoctypeSystemIdentifier), t.forceQuirks = !0, this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.missingQuoteBeforeDoctypeSystemIdentifier), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateBeforeDoctypeSystemIdentifier(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.QUOTATION_MARK:
        t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      case r.APOSTROPHE:
        t.systemId = "", this.state = i.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.missingDoctypeSystemIdentifier), t.forceQuirks = !0, this.state = i.DATA, this.emitCurrentDoctype(t);
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.missingQuoteBeforeDoctypeSystemIdentifier), t.forceQuirks = !0, this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateDoctypeSystemIdentifierDoubleQuoted(e) {
    const t = this.currentToken;
    switch (e) {
      case r.QUOTATION_MARK:
        this.state = i.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.systemId += u;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.abruptDoctypeSystemIdentifier), t.forceQuirks = !0, this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        t.systemId += String.fromCodePoint(e);
    }
  }
  _stateDoctypeSystemIdentifierSingleQuoted(e) {
    const t = this.currentToken;
    switch (e) {
      case r.APOSTROPHE:
        this.state = i.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter), t.systemId += u;
        break;
      case r.GREATER_THAN_SIGN:
        this._err(E.abruptDoctypeSystemIdentifier), t.forceQuirks = !0, this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        t.systemId += String.fromCodePoint(e);
    }
  }
  _stateAfterDoctypeSystemIdentifier(e) {
    const t = this.currentToken;
    switch (e) {
      case r.SPACE:
      case r.LINE_FEED:
      case r.TABULATION:
      case r.FORM_FEED:
        break;
      case r.GREATER_THAN_SIGN:
        this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.EOF:
        this._err(E.eofInDoctype), t.forceQuirks = !0, this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
      default:
        this._err(E.unexpectedCharacterAfterDoctypeSystemIdentifier), this.state = i.BOGUS_DOCTYPE, this._stateBogusDoctype(e);
    }
  }
  _stateBogusDoctype(e) {
    const t = this.currentToken;
    switch (e) {
      case r.GREATER_THAN_SIGN:
        this.emitCurrentDoctype(t), this.state = i.DATA;
        break;
      case r.NULL:
        this._err(E.unexpectedNullCharacter);
        break;
      case r.EOF:
        this.emitCurrentDoctype(t), this._emitEOFToken();
        break;
    }
  }
  _stateCdataSection(e) {
    switch (e) {
      case r.RIGHT_SQUARE_BRACKET:
        this.state = i.CDATA_SECTION_BRACKET;
        break;
      case r.EOF:
        this._err(E.eofInCdata), this._emitEOFToken();
        break;
      default:
        this._emitCodePoint(e);
    }
  }
  _stateCdataSectionBracket(e) {
    e === r.RIGHT_SQUARE_BRACKET ? this.state = i.CDATA_SECTION_END : (this._emitChars("]"), this.state = i.CDATA_SECTION, this._stateCdataSection(e));
  }
  _stateCdataSectionEnd(e) {
    switch (e) {
      case r.GREATER_THAN_SIGN:
        this.state = i.DATA;
        break;
      case r.RIGHT_SQUARE_BRACKET:
        this._emitChars("]");
        break;
      default:
        this._emitChars("]]"), this.state = i.CDATA_SECTION, this._stateCdataSection(e);
    }
  }
  _stateCharacterReference() {
    let e = this.entityDecoder.write(this.preprocessor.html, this.preprocessor.pos);
    if (e < 0) if (this.preprocessor.lastChunkWritten) e = this.entityDecoder.end();
    else {
      this.active = !1, this.preprocessor.pos = this.preprocessor.html.length - 1, this.consumedAfterSnapshot = 0, this.preprocessor.endOfChunkHit = !0;
      return;
    }
    e === 0 ? (this.preprocessor.pos = this.entityStartPos, this._flushCodePointConsumedAsCharacterReference(r.AMPERSAND), this.state = !this._isCharacterReferenceInAttribute() && he(this.preprocessor.peek(1)) ? i.AMBIGUOUS_AMPERSAND : this.returnState) : this.state = this.returnState;
  }
  _stateAmbiguousAmpersand(e) {
    he(e) ? this._flushCodePointConsumedAsCharacterReference(e) : (e === r.SEMICOLON && this._err(E.unknownNamedCharacterReference), this.state = this.returnState, this._callState(e));
  }
};
const pe = /* @__PURE__ */ new Set([
  s.DD,
  s.DT,
  s.LI,
  s.OPTGROUP,
  s.OPTION,
  s.P,
  s.RB,
  s.RP,
  s.RT,
  s.RTC
]), _e = /* @__PURE__ */ new Set([
  ...pe,
  s.CAPTION,
  s.COLGROUP,
  s.TBODY,
  s.TD,
  s.TFOOT,
  s.TH,
  s.THEAD,
  s.TR
]), X = /* @__PURE__ */ new Set([
  s.APPLET,
  s.CAPTION,
  s.HTML,
  s.MARQUEE,
  s.OBJECT,
  s.TABLE,
  s.TD,
  s.TEMPLATE,
  s.TH
]), dt = /* @__PURE__ */ new Set([
  ...X,
  s.OL,
  s.UL
]), ut = /* @__PURE__ */ new Set([...X, s.BUTTON]), me = /* @__PURE__ */ new Set([
  s.ANNOTATION_XML,
  s.MI,
  s.MN,
  s.MO,
  s.MS,
  s.MTEXT
]), de = /* @__PURE__ */ new Set([
  s.DESC,
  s.FOREIGN_OBJECT,
  s.TITLE
]), At = /* @__PURE__ */ new Set([
  s.TR,
  s.TEMPLATE,
  s.HTML
]), Nt = /* @__PURE__ */ new Set([
  s.TBODY,
  s.TFOOT,
  s.THEAD,
  s.TEMPLATE,
  s.HTML
]), It = /* @__PURE__ */ new Set([
  s.TABLE,
  s.TEMPLATE,
  s.HTML
]), ft = /* @__PURE__ */ new Set([s.TD, s.TH]);
var Ct = class {
  get currentTmplContentOrNode() {
    return this._isInTemplate() ? this.treeAdapter.getTemplateContent(this.current) : this.current;
  }
  constructor(e, t, a) {
    this.treeAdapter = t, this.handler = a, this.items = [], this.tagIDs = [], this.stackTop = -1, this.tmplCount = 0, this.currentTagId = s.UNKNOWN, this.current = e;
  }
  _indexOf(e) {
    return this.items.lastIndexOf(e, this.stackTop);
  }
  _isInTemplate() {
    return this.currentTagId === s.TEMPLATE && this.treeAdapter.getNamespaceURI(this.current) === h.HTML;
  }
  _updateCurrentElement() {
    this.current = this.items[this.stackTop], this.currentTagId = this.tagIDs[this.stackTop];
  }
  push(e, t) {
    this.stackTop++, this.items[this.stackTop] = e, this.current = e, this.tagIDs[this.stackTop] = t, this.currentTagId = t, this._isInTemplate() && this.tmplCount++, this.handler.onItemPush(e, t, !0);
  }
  pop() {
    const e = this.current;
    this.tmplCount > 0 && this._isInTemplate() && this.tmplCount--, this.stackTop--, this._updateCurrentElement(), this.handler.onItemPop(e, !0);
  }
  replace(e, t) {
    const a = this._indexOf(e);
    this.items[a] = t, a === this.stackTop && (this.current = t);
  }
  insertAfter(e, t, a) {
    const o = this._indexOf(e) + 1;
    this.items.splice(o, 0, t), this.tagIDs.splice(o, 0, a), this.stackTop++, o === this.stackTop && this._updateCurrentElement(), this.current && this.currentTagId !== void 0 && this.handler.onItemPush(this.current, this.currentTagId, o === this.stackTop);
  }
  popUntilTagNamePopped(e) {
    let t = this.stackTop + 1;
    do
      t = this.tagIDs.lastIndexOf(e, t - 1);
    while (t > 0 && this.treeAdapter.getNamespaceURI(this.items[t]) !== h.HTML);
    this.shortenToLength(Math.max(t, 0));
  }
  shortenToLength(e) {
    for (; this.stackTop >= e; ) {
      const t = this.current;
      this.tmplCount > 0 && this._isInTemplate() && (this.tmplCount -= 1), this.stackTop--, this._updateCurrentElement(), this.handler.onItemPop(t, this.stackTop < e);
    }
  }
  popUntilElementPopped(e) {
    const t = this._indexOf(e);
    this.shortenToLength(Math.max(t, 0));
  }
  popUntilPopped(e, t) {
    const a = this._indexOfTagNames(e, t);
    this.shortenToLength(Math.max(a, 0));
  }
  popUntilNumberedHeaderPopped() {
    this.popUntilPopped(re, h.HTML);
  }
  popUntilTableCellPopped() {
    this.popUntilPopped(ft, h.HTML);
  }
  popAllUpToHtmlElement() {
    this.tmplCount = 0, this.shortenToLength(1);
  }
  _indexOfTagNames(e, t) {
    for (let a = this.stackTop; a >= 0; a--) if (e.has(this.tagIDs[a]) && this.treeAdapter.getNamespaceURI(this.items[a]) === t) return a;
    return -1;
  }
  clearBackTo(e, t) {
    const a = this._indexOfTagNames(e, t);
    this.shortenToLength(a + 1);
  }
  clearBackToTableContext() {
    this.clearBackTo(It, h.HTML);
  }
  clearBackToTableBodyContext() {
    this.clearBackTo(Nt, h.HTML);
  }
  clearBackToTableRowContext() {
    this.clearBackTo(At, h.HTML);
  }
  remove(e) {
    const t = this._indexOf(e);
    t >= 0 && (t === this.stackTop ? this.pop() : (this.items.splice(t, 1), this.tagIDs.splice(t, 1), this.stackTop--, this._updateCurrentElement(), this.handler.onItemPop(e, !1)));
  }
  tryPeekProperlyNestedBodyElement() {
    return this.stackTop >= 1 && this.tagIDs[1] === s.BODY ? this.items[1] : null;
  }
  contains(e) {
    return this._indexOf(e) > -1;
  }
  getCommonAncestor(e) {
    const t = this._indexOf(e) - 1;
    return t >= 0 ? this.items[t] : null;
  }
  isRootHtmlElementCurrent() {
    return this.stackTop === 0 && this.tagIDs[0] === s.HTML;
  }
  hasInDynamicScope(e, t) {
    for (let a = this.stackTop; a >= 0; a--) {
      const o = this.tagIDs[a];
      switch (this.treeAdapter.getNamespaceURI(this.items[a])) {
        case h.HTML:
          if (o === e) return !0;
          if (t.has(o)) return !1;
          break;
        case h.SVG:
          if (de.has(o)) return !1;
          break;
        case h.MATHML:
          if (me.has(o)) return !1;
          break;
      }
    }
    return !0;
  }
  hasInScope(e) {
    return this.hasInDynamicScope(e, X);
  }
  hasInListItemScope(e) {
    return this.hasInDynamicScope(e, dt);
  }
  hasInButtonScope(e) {
    return this.hasInDynamicScope(e, ut);
  }
  hasNumberedHeaderInScope() {
    for (let e = this.stackTop; e >= 0; e--) {
      const t = this.tagIDs[e];
      switch (this.treeAdapter.getNamespaceURI(this.items[e])) {
        case h.HTML:
          if (re.has(t)) return !0;
          if (X.has(t)) return !1;
          break;
        case h.SVG:
          if (de.has(t)) return !1;
          break;
        case h.MATHML:
          if (me.has(t)) return !1;
          break;
      }
    }
    return !0;
  }
  hasInTableScope(e) {
    for (let t = this.stackTop; t >= 0; t--)
      if (this.treeAdapter.getNamespaceURI(this.items[t]) === h.HTML)
        switch (this.tagIDs[t]) {
          case e:
            return !0;
          case s.TABLE:
          case s.HTML:
            return !1;
        }
    return !0;
  }
  hasTableBodyContextInTableScope() {
    for (let e = this.stackTop; e >= 0; e--)
      if (this.treeAdapter.getNamespaceURI(this.items[e]) === h.HTML)
        switch (this.tagIDs[e]) {
          case s.TBODY:
          case s.THEAD:
          case s.TFOOT:
            return !0;
          case s.TABLE:
          case s.HTML:
            return !1;
        }
    return !0;
  }
  hasInSelectScope(e) {
    for (let t = this.stackTop; t >= 0; t--)
      if (this.treeAdapter.getNamespaceURI(this.items[t]) === h.HTML)
        switch (this.tagIDs[t]) {
          case e:
            return !0;
          case s.OPTION:
          case s.OPTGROUP:
            break;
          default:
            return !1;
        }
    return !0;
  }
  generateImpliedEndTags() {
    for (; this.currentTagId !== void 0 && pe.has(this.currentTagId); ) this.pop();
  }
  generateImpliedEndTagsThoroughly() {
    for (; this.currentTagId !== void 0 && _e.has(this.currentTagId); ) this.pop();
  }
  generateImpliedEndTagsWithExclusion(e) {
    for (; this.currentTagId !== void 0 && this.currentTagId !== e && _e.has(this.currentTagId); ) this.pop();
  }
};
const te = 3;
var D;
(function(e) {
  e[e.Marker = 0] = "Marker", e[e.Element = 1] = "Element";
})(D || (D = {}));
const ue = { type: D.Marker };
var Ot = class {
  constructor(e) {
    this.treeAdapter = e, this.entries = [], this.bookmark = null;
  }
  _getNoahArkConditionCandidates(e, t) {
    const a = [], o = t.length, T = this.treeAdapter.getTagName(e), _ = this.treeAdapter.getNamespaceURI(e);
    for (let m = 0; m < this.entries.length; m++) {
      const I = this.entries[m];
      if (I.type === D.Marker) break;
      const { element: C } = I;
      if (this.treeAdapter.getTagName(C) === T && this.treeAdapter.getNamespaceURI(C) === _) {
        const k = this.treeAdapter.getAttrList(C);
        k.length === o && a.push({
          idx: m,
          attrs: k
        });
      }
    }
    return a;
  }
  _ensureNoahArkCondition(e) {
    if (this.entries.length < te) return;
    const t = this.treeAdapter.getAttrList(e), a = this._getNoahArkConditionCandidates(e, t);
    if (a.length < te) return;
    const o = new Map(t.map((_) => [_.name, _.value]));
    let T = 0;
    for (let _ = 0; _ < a.length; _++) {
      const m = a[_];
      m.attrs.every((I) => o.get(I.name) === I.value) && (T += 1, T >= te && this.entries.splice(m.idx, 1));
    }
  }
  insertMarker() {
    this.entries.unshift(ue);
  }
  pushElement(e, t) {
    this._ensureNoahArkCondition(e), this.entries.unshift({
      type: D.Element,
      element: e,
      token: t
    });
  }
  insertElementAfterBookmark(e, t) {
    const a = this.entries.indexOf(this.bookmark);
    this.entries.splice(a, 0, {
      type: D.Element,
      element: e,
      token: t
    });
  }
  removeEntry(e) {
    const t = this.entries.indexOf(e);
    t !== -1 && this.entries.splice(t, 1);
  }
  /**
  * Clears the list of formatting elements up to the last marker.
  *
  * @see https://html.spec.whatwg.org/multipage/parsing.html#clear-the-list-of-active-formatting-elements-up-to-the-last-marker
  */
  clearToLastMarker() {
    const e = this.entries.indexOf(ue);
    e === -1 ? this.entries.length = 0 : this.entries.splice(0, e + 1);
  }
  getElementEntryInScopeWithTagName(e) {
    const t = this.entries.find((a) => a.type === D.Marker || this.treeAdapter.getTagName(a.element) === e);
    return t && t.type === D.Element ? t : null;
  }
  getElementEntry(e) {
    return this.entries.find((t) => t.type === D.Element && t.element === e);
  }
};
const P = {
  createDocument() {
    return {
      nodeName: "#document",
      mode: L.NO_QUIRKS,
      childNodes: []
    };
  },
  createDocumentFragment() {
    return {
      nodeName: "#document-fragment",
      childNodes: []
    };
  },
  createElement(e, t, a) {
    return {
      nodeName: e,
      tagName: e,
      attrs: a,
      namespaceURI: t,
      childNodes: [],
      parentNode: null
    };
  },
  createCommentNode(e) {
    return {
      nodeName: "#comment",
      data: e,
      parentNode: null
    };
  },
  createTextNode(e) {
    return {
      nodeName: "#text",
      value: e,
      parentNode: null
    };
  },
  appendChild(e, t) {
    e.childNodes.push(t), t.parentNode = e;
  },
  insertBefore(e, t, a) {
    const o = e.childNodes.indexOf(a);
    e.childNodes.splice(o, 0, t), t.parentNode = e;
  },
  setTemplateContent(e, t) {
    e.content = t;
  },
  getTemplateContent(e) {
    return e.content;
  },
  setDocumentType(e, t, a, o) {
    const T = e.childNodes.find((_) => _.nodeName === "#documentType");
    T ? (T.name = t, T.publicId = a, T.systemId = o) : P.appendChild(e, {
      nodeName: "#documentType",
      name: t,
      publicId: a,
      systemId: o,
      parentNode: null
    });
  },
  setDocumentMode(e, t) {
    e.mode = t;
  },
  getDocumentMode(e) {
    return e.mode;
  },
  detachNode(e) {
    if (e.parentNode) {
      const t = e.parentNode.childNodes.indexOf(e);
      e.parentNode.childNodes.splice(t, 1), e.parentNode = null;
    }
  },
  insertText(e, t) {
    if (e.childNodes.length > 0) {
      const a = e.childNodes[e.childNodes.length - 1];
      if (P.isTextNode(a)) {
        a.value += t;
        return;
      }
    }
    P.appendChild(e, P.createTextNode(t));
  },
  insertTextBefore(e, t, a) {
    const o = e.childNodes[e.childNodes.indexOf(a) - 1];
    o && P.isTextNode(o) ? o.value += t : P.insertBefore(e, P.createTextNode(t), a);
  },
  adoptAttributes(e, t) {
    const a = new Set(e.attrs.map((o) => o.name));
    for (let o = 0; o < t.length; o++) a.has(t[o].name) || e.attrs.push(t[o]);
  },
  getFirstChild(e) {
    return e.childNodes[0];
  },
  getChildNodes(e) {
    return e.childNodes;
  },
  getParentNode(e) {
    return e.parentNode;
  },
  getAttrList(e) {
    return e.attrs;
  },
  getTagName(e) {
    return e.tagName;
  },
  getNamespaceURI(e) {
    return e.namespaceURI;
  },
  getTextNodeContent(e) {
    return e.value;
  },
  getCommentNodeContent(e) {
    return e.data;
  },
  getDocumentTypeNodeName(e) {
    return e.name;
  },
  getDocumentTypeNodePublicId(e) {
    return e.publicId;
  },
  getDocumentTypeNodeSystemId(e) {
    return e.systemId;
  },
  isTextNode(e) {
    return e.nodeName === "#text";
  },
  isCommentNode(e) {
    return e.nodeName === "#comment";
  },
  isDocumentTypeNode(e) {
    return e.nodeName === "#documentType";
  },
  isElementNode(e) {
    return Object.prototype.hasOwnProperty.call(e, "tagName");
  },
  setNodeSourceCodeLocation(e, t) {
    e.sourceCodeLocation = t;
  },
  getNodeSourceCodeLocation(e) {
    return e.sourceCodeLocation;
  },
  updateNodeSourceCodeLocation(e, t) {
    e.sourceCodeLocation = {
      ...e.sourceCodeLocation,
      ...t
    };
  }
}, ge = "html", St = "about:legacy-compat", Lt = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd", Pe = [
  "+//silmaril//dtd html pro v0r11 19970101//",
  "-//as//dtd html 3.0 aswedit + extensions//",
  "-//advasoft ltd//dtd html 3.0 aswedit + extensions//",
  "-//ietf//dtd html 2.0 level 1//",
  "-//ietf//dtd html 2.0 level 2//",
  "-//ietf//dtd html 2.0 strict level 1//",
  "-//ietf//dtd html 2.0 strict level 2//",
  "-//ietf//dtd html 2.0 strict//",
  "-//ietf//dtd html 2.0//",
  "-//ietf//dtd html 2.1e//",
  "-//ietf//dtd html 3.0//",
  "-//ietf//dtd html 3.2 final//",
  "-//ietf//dtd html 3.2//",
  "-//ietf//dtd html 3//",
  "-//ietf//dtd html level 0//",
  "-//ietf//dtd html level 1//",
  "-//ietf//dtd html level 2//",
  "-//ietf//dtd html level 3//",
  "-//ietf//dtd html strict level 0//",
  "-//ietf//dtd html strict level 1//",
  "-//ietf//dtd html strict level 2//",
  "-//ietf//dtd html strict level 3//",
  "-//ietf//dtd html strict//",
  "-//ietf//dtd html//",
  "-//metrius//dtd metrius presentational//",
  "-//microsoft//dtd internet explorer 2.0 html strict//",
  "-//microsoft//dtd internet explorer 2.0 html//",
  "-//microsoft//dtd internet explorer 2.0 tables//",
  "-//microsoft//dtd internet explorer 3.0 html strict//",
  "-//microsoft//dtd internet explorer 3.0 html//",
  "-//microsoft//dtd internet explorer 3.0 tables//",
  "-//netscape comm. corp.//dtd html//",
  "-//netscape comm. corp.//dtd strict html//",
  "-//o'reilly and associates//dtd html 2.0//",
  "-//o'reilly and associates//dtd html extended 1.0//",
  "-//o'reilly and associates//dtd html extended relaxed 1.0//",
  "-//sq//dtd html 2.0 hotmetal + extensions//",
  "-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//",
  "-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//",
  "-//spyglass//dtd html 2.0 extended//",
  "-//sun microsystems corp.//dtd hotjava html//",
  "-//sun microsystems corp.//dtd hotjava strict html//",
  "-//w3c//dtd html 3 1995-03-24//",
  "-//w3c//dtd html 3.2 draft//",
  "-//w3c//dtd html 3.2 final//",
  "-//w3c//dtd html 3.2//",
  "-//w3c//dtd html 3.2s draft//",
  "-//w3c//dtd html 4.0 frameset//",
  "-//w3c//dtd html 4.0 transitional//",
  "-//w3c//dtd html experimental 19960712//",
  "-//w3c//dtd html experimental 970421//",
  "-//w3c//dtd w3 html//",
  "-//w3o//dtd w3 html 3.0//",
  "-//webtechs//dtd mozilla html 2.0//",
  "-//webtechs//dtd mozilla html//"
], Rt = [
  ...Pe,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
], Dt = /* @__PURE__ */ new Set([
  "-//w3o//dtd w3 html strict 3.0//en//",
  "-/w3c/dtd html 4.0 transitional/en",
  "html"
]), be = ["-//w3c//dtd xhtml 1.0 frameset//", "-//w3c//dtd xhtml 1.0 transitional//"], pt = [
  ...be,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
function Ae(e, t) {
  return t.some((a) => e.startsWith(a));
}
function gt(e) {
  return e.name === ge && e.publicId === null && (e.systemId === null || e.systemId === St);
}
function Pt(e) {
  if (e.name !== ge) return L.QUIRKS;
  const { systemId: t } = e;
  if (t && t.toLowerCase() === Lt) return L.QUIRKS;
  let { publicId: a } = e;
  if (a !== null) {
    if (a = a.toLowerCase(), Dt.has(a)) return L.QUIRKS;
    let o = t === null ? Rt : Pe;
    if (Ae(a, o)) return L.QUIRKS;
    if (o = t === null ? be : pt, Ae(a, o)) return L.LIMITED_QUIRKS;
  }
  return L.NO_QUIRKS;
}
const Ne = {
  TEXT_HTML: "text/html",
  APPLICATION_XML: "application/xhtml+xml"
}, bt = "definitionurl", Mt = "definitionURL", Bt = new Map([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan"
].map((e) => [e.toLowerCase(), e])), Ht = /* @__PURE__ */ new Map([
  ["xlink:actuate", {
    prefix: "xlink",
    name: "actuate",
    namespace: h.XLINK
  }],
  ["xlink:arcrole", {
    prefix: "xlink",
    name: "arcrole",
    namespace: h.XLINK
  }],
  ["xlink:href", {
    prefix: "xlink",
    name: "href",
    namespace: h.XLINK
  }],
  ["xlink:role", {
    prefix: "xlink",
    name: "role",
    namespace: h.XLINK
  }],
  ["xlink:show", {
    prefix: "xlink",
    name: "show",
    namespace: h.XLINK
  }],
  ["xlink:title", {
    prefix: "xlink",
    name: "title",
    namespace: h.XLINK
  }],
  ["xlink:type", {
    prefix: "xlink",
    name: "type",
    namespace: h.XLINK
  }],
  ["xml:lang", {
    prefix: "xml",
    name: "lang",
    namespace: h.XML
  }],
  ["xml:space", {
    prefix: "xml",
    name: "space",
    namespace: h.XML
  }],
  ["xmlns", {
    prefix: "",
    name: "xmlns",
    namespace: h.XMLNS
  }],
  ["xmlns:xlink", {
    prefix: "xmlns",
    name: "xlink",
    namespace: h.XMLNS
  }]
]), kt = new Map([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "clipPath",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "foreignObject",
  "glyphRef",
  "linearGradient",
  "radialGradient",
  "textPath"
].map((e) => [e.toLowerCase(), e])), Ut = /* @__PURE__ */ new Set([
  s.B,
  s.BIG,
  s.BLOCKQUOTE,
  s.BODY,
  s.BR,
  s.CENTER,
  s.CODE,
  s.DD,
  s.DIV,
  s.DL,
  s.DT,
  s.EM,
  s.EMBED,
  s.H1,
  s.H2,
  s.H3,
  s.H4,
  s.H5,
  s.H6,
  s.HEAD,
  s.HR,
  s.I,
  s.IMG,
  s.LI,
  s.LISTING,
  s.MENU,
  s.META,
  s.NOBR,
  s.OL,
  s.P,
  s.PRE,
  s.RUBY,
  s.S,
  s.SMALL,
  s.SPAN,
  s.STRONG,
  s.STRIKE,
  s.SUB,
  s.SUP,
  s.TABLE,
  s.TT,
  s.U,
  s.UL,
  s.VAR
]);
function Ft(e) {
  const t = e.tagID;
  return t === s.FONT && e.attrs.some(({ name: a }) => a === M.COLOR || a === M.SIZE || a === M.FACE) || Ut.has(t);
}
function Me(e) {
  for (let t = 0; t < e.attrs.length; t++) if (e.attrs[t].name === bt) {
    e.attrs[t].name = Mt;
    break;
  }
}
function Be(e) {
  for (let t = 0; t < e.attrs.length; t++) {
    const a = Bt.get(e.attrs[t].name);
    a != null && (e.attrs[t].name = a);
  }
}
function oe(e) {
  for (let t = 0; t < e.attrs.length; t++) {
    const a = Ht.get(e.attrs[t].name);
    a && (e.attrs[t].prefix = a.prefix, e.attrs[t].name = a.name, e.attrs[t].namespace = a.namespace);
  }
}
function yt(e) {
  const t = kt.get(e.tagName);
  t != null && (e.tagName = t, e.tagID = J(e.tagName));
}
function wt(e, t) {
  return t === h.MATHML && (e === s.MI || e === s.MO || e === s.MN || e === s.MS || e === s.MTEXT);
}
function xt(e, t, a) {
  if (t === h.MATHML && e === s.ANNOTATION_XML) {
    for (let o = 0; o < a.length; o++) if (a[o].name === M.ENCODING) {
      const T = a[o].value.toLowerCase();
      return T === Ne.TEXT_HTML || T === Ne.APPLICATION_XML;
    }
  }
  return t === h.SVG && (e === s.FOREIGN_OBJECT || e === s.DESC || e === s.TITLE);
}
function Yt(e, t, a, o) {
  return (!o || o === h.HTML) && xt(e, t, a) || (!o || o === h.MATHML) && wt(e, t);
}
const vt = "hidden", Qt = 8, Wt = 3;
var n;
(function(e) {
  e[e.INITIAL = 0] = "INITIAL", e[e.BEFORE_HTML = 1] = "BEFORE_HTML", e[e.BEFORE_HEAD = 2] = "BEFORE_HEAD", e[e.IN_HEAD = 3] = "IN_HEAD", e[e.IN_HEAD_NO_SCRIPT = 4] = "IN_HEAD_NO_SCRIPT", e[e.AFTER_HEAD = 5] = "AFTER_HEAD", e[e.IN_BODY = 6] = "IN_BODY", e[e.TEXT = 7] = "TEXT", e[e.IN_TABLE = 8] = "IN_TABLE", e[e.IN_TABLE_TEXT = 9] = "IN_TABLE_TEXT", e[e.IN_CAPTION = 10] = "IN_CAPTION", e[e.IN_COLUMN_GROUP = 11] = "IN_COLUMN_GROUP", e[e.IN_TABLE_BODY = 12] = "IN_TABLE_BODY", e[e.IN_ROW = 13] = "IN_ROW", e[e.IN_CELL = 14] = "IN_CELL", e[e.IN_SELECT = 15] = "IN_SELECT", e[e.IN_SELECT_IN_TABLE = 16] = "IN_SELECT_IN_TABLE", e[e.IN_TEMPLATE = 17] = "IN_TEMPLATE", e[e.AFTER_BODY = 18] = "AFTER_BODY", e[e.IN_FRAMESET = 19] = "IN_FRAMESET", e[e.AFTER_FRAMESET = 20] = "AFTER_FRAMESET", e[e.AFTER_AFTER_BODY = 21] = "AFTER_AFTER_BODY", e[e.AFTER_AFTER_FRAMESET = 22] = "AFTER_AFTER_FRAMESET";
})(n || (n = {}));
const Gt = {
  startLine: -1,
  startCol: -1,
  startOffset: -1,
  endLine: -1,
  endCol: -1,
  endOffset: -1
}, He = /* @__PURE__ */ new Set([
  s.TABLE,
  s.TBODY,
  s.TFOOT,
  s.THEAD,
  s.TR
]), Ie = {
  scriptingEnabled: !0,
  sourceCodeLocationInfo: !1,
  treeAdapter: P,
  onParseError: null
};
var qt = class {
  constructor(e, t, a = null, o = null) {
    this.fragmentContext = a, this.scriptHandler = o, this.currentToken = null, this.stopped = !1, this.insertionMode = n.INITIAL, this.originalInsertionMode = n.INITIAL, this.headElement = null, this.formElement = null, this.currentNotInHTML = !1, this.tmplInsertionModeStack = [], this.pendingCharacterTokens = [], this.hasNonWhitespacePendingCharacterToken = !1, this.framesetOk = !0, this.skipNextNewLine = !1, this.fosterParentingEnabled = !1, this.options = {
      ...Ie,
      ...e
    }, this.treeAdapter = this.options.treeAdapter, this.onParseError = this.options.onParseError, this.onParseError && (this.options.sourceCodeLocationInfo = !0), this.document = t ?? this.treeAdapter.createDocument(), this.tokenizer = new mt(this.options, this), this.activeFormattingElements = new Ot(this.treeAdapter), this.fragmentContextID = a ? J(this.treeAdapter.getTagName(a)) : s.UNKNOWN, this._setContextModes(a ?? this.document, this.fragmentContextID), this.openElements = new Ct(this.document, this.treeAdapter, this);
  }
  static parse(e, t) {
    const a = new this(t);
    return a.tokenizer.write(e, !0), a.document;
  }
  static getFragmentParser(e, t) {
    const a = {
      ...Ie,
      ...t
    };
    e != null || (e = a.treeAdapter.createElement(c.TEMPLATE, h.HTML, []));
    const o = a.treeAdapter.createElement("documentmock", h.HTML, []), T = new this(a, o, e);
    return T.fragmentContextID === s.TEMPLATE && T.tmplInsertionModeStack.unshift(n.IN_TEMPLATE), T._initTokenizerForFragmentParsing(), T._insertFakeRootElement(), T._resetInsertionMode(), T._findFormInFragmentContext(), T;
  }
  getFragment() {
    const e = this.treeAdapter.getFirstChild(this.document), t = this.treeAdapter.createDocumentFragment();
    return this._adoptNodes(e, t), t;
  }
  /** @internal */
  _err(e, t, a) {
    var o;
    if (!this.onParseError) return;
    const T = (o = e.location) !== null && o !== void 0 ? o : Gt;
    this.onParseError({
      code: t,
      startLine: T.startLine,
      startCol: T.startCol,
      startOffset: T.startOffset,
      endLine: a ? T.startLine : T.endLine,
      endCol: a ? T.startCol : T.endCol,
      endOffset: a ? T.startOffset : T.endOffset
    });
  }
  /** @internal */
  onItemPush(e, t, a) {
    var o, T;
    (T = (o = this.treeAdapter).onItemPush) === null || T === void 0 || T.call(o, e), a && this.openElements.stackTop > 0 && this._setContextModes(e, t);
  }
  /** @internal */
  onItemPop(e, t) {
    var a, o;
    if (this.options.sourceCodeLocationInfo && this._setEndLocation(e, this.currentToken), (o = (a = this.treeAdapter).onItemPop) === null || o === void 0 || o.call(a, e, this.openElements.current), t) {
      let T, _;
      this.openElements.stackTop === 0 && this.fragmentContext ? (T = this.fragmentContext, _ = this.fragmentContextID) : { current: T, currentTagId: _ } = this.openElements, this._setContextModes(T, _);
    }
  }
  _setContextModes(e, t) {
    const a = e === this.document || e && this.treeAdapter.getNamespaceURI(e) === h.HTML;
    this.currentNotInHTML = !a, this.tokenizer.inForeignNode = !a && e !== void 0 && t !== void 0 && !this._isIntegrationPoint(t, e);
  }
  /** @protected */
  _switchToTextParsing(e, t) {
    this._insertElement(e, h.HTML), this.tokenizer.state = t, this.originalInsertionMode = this.insertionMode, this.insertionMode = n.TEXT;
  }
  switchToPlaintextParsing() {
    this.insertionMode = n.TEXT, this.originalInsertionMode = n.IN_BODY, this.tokenizer.state = S.PLAINTEXT;
  }
  /** @protected */
  _getAdjustedCurrentElement() {
    return this.openElements.stackTop === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.current;
  }
  /** @protected */
  _findFormInFragmentContext() {
    let e = this.fragmentContext;
    for (; e; ) {
      if (this.treeAdapter.getTagName(e) === c.FORM) {
        this.formElement = e;
        break;
      }
      e = this.treeAdapter.getParentNode(e);
    }
  }
  _initTokenizerForFragmentParsing() {
    if (!(!this.fragmentContext || this.treeAdapter.getNamespaceURI(this.fragmentContext) !== h.HTML))
      switch (this.fragmentContextID) {
        case s.TITLE:
        case s.TEXTAREA:
          this.tokenizer.state = S.RCDATA;
          break;
        case s.STYLE:
        case s.XMP:
        case s.IFRAME:
        case s.NOEMBED:
        case s.NOFRAMES:
        case s.NOSCRIPT:
          this.tokenizer.state = S.RAWTEXT;
          break;
        case s.SCRIPT:
          this.tokenizer.state = S.SCRIPT_DATA;
          break;
        case s.PLAINTEXT:
          this.tokenizer.state = S.PLAINTEXT;
          break;
      }
  }
  /** @protected */
  _setDocumentType(e) {
    if (this.treeAdapter.setDocumentType(this.document, e.name || "", e.publicId || "", e.systemId || ""), e.location) {
      const t = this.treeAdapter.getChildNodes(this.document).find((a) => this.treeAdapter.isDocumentTypeNode(a));
      t && this.treeAdapter.setNodeSourceCodeLocation(t, e.location);
    }
  }
  /** @protected */
  _attachElementToTree(e, t) {
    if (this.options.sourceCodeLocationInfo) {
      const a = t && {
        ...t,
        startTag: t
      };
      this.treeAdapter.setNodeSourceCodeLocation(e, a);
    }
    if (this._shouldFosterParentOnInsertion()) this._fosterParentElement(e);
    else {
      const a = this.openElements.currentTmplContentOrNode;
      this.treeAdapter.appendChild(a ?? this.document, e);
    }
  }
  /**
  * For self-closing tags. Add an element to the tree, but skip adding it
  * to the stack.
  */
  /** @protected */
  _appendElement(e, t) {
    const a = this.treeAdapter.createElement(e.tagName, t, e.attrs);
    this._attachElementToTree(a, e.location);
  }
  /** @protected */
  _insertElement(e, t) {
    const a = this.treeAdapter.createElement(e.tagName, t, e.attrs);
    this._attachElementToTree(a, e.location), this.openElements.push(a, e.tagID);
  }
  /** @protected */
  _insertFakeElement(e, t) {
    const a = this.treeAdapter.createElement(e, h.HTML, []);
    this._attachElementToTree(a, null), this.openElements.push(a, t);
  }
  /** @protected */
  _insertTemplate(e) {
    const t = this.treeAdapter.createElement(e.tagName, h.HTML, e.attrs), a = this.treeAdapter.createDocumentFragment();
    this.treeAdapter.setTemplateContent(t, a), this._attachElementToTree(t, e.location), this.openElements.push(t, e.tagID), this.options.sourceCodeLocationInfo && this.treeAdapter.setNodeSourceCodeLocation(a, null);
  }
  /** @protected */
  _insertFakeRootElement() {
    const e = this.treeAdapter.createElement(c.HTML, h.HTML, []);
    this.options.sourceCodeLocationInfo && this.treeAdapter.setNodeSourceCodeLocation(e, null), this.treeAdapter.appendChild(this.openElements.current, e), this.openElements.push(e, s.HTML);
  }
  /** @protected */
  _appendCommentNode(e, t) {
    const a = this.treeAdapter.createCommentNode(e.data);
    this.treeAdapter.appendChild(t, a), this.options.sourceCodeLocationInfo && this.treeAdapter.setNodeSourceCodeLocation(a, e.location);
  }
  /** @protected */
  _insertCharacters(e) {
    let t, a;
    if (this._shouldFosterParentOnInsertion() ? ({ parent: t, beforeElement: a } = this._findFosterParentingLocation(), a ? this.treeAdapter.insertTextBefore(t, e.chars, a) : this.treeAdapter.insertText(t, e.chars)) : (t = this.openElements.currentTmplContentOrNode, this.treeAdapter.insertText(t, e.chars)), !e.location) return;
    const o = this.treeAdapter.getChildNodes(t), T = o[(a ? o.lastIndexOf(a) : o.length) - 1];
    if (this.treeAdapter.getNodeSourceCodeLocation(T)) {
      const { endLine: _, endCol: m, endOffset: I } = e.location;
      this.treeAdapter.updateNodeSourceCodeLocation(T, {
        endLine: _,
        endCol: m,
        endOffset: I
      });
    } else this.options.sourceCodeLocationInfo && this.treeAdapter.setNodeSourceCodeLocation(T, e.location);
  }
  /** @protected */
  _adoptNodes(e, t) {
    for (let a = this.treeAdapter.getFirstChild(e); a; a = this.treeAdapter.getFirstChild(e))
      this.treeAdapter.detachNode(a), this.treeAdapter.appendChild(t, a);
  }
  /** @protected */
  _setEndLocation(e, t) {
    if (this.treeAdapter.getNodeSourceCodeLocation(e) && t.location) {
      const a = t.location, o = this.treeAdapter.getTagName(e), T = t.type === d.END_TAG && o === t.tagName ? {
        endTag: { ...a },
        endLine: a.endLine,
        endCol: a.endCol,
        endOffset: a.endOffset
      } : {
        endLine: a.startLine,
        endCol: a.startCol,
        endOffset: a.startOffset
      };
      this.treeAdapter.updateNodeSourceCodeLocation(e, T);
    }
  }
  shouldProcessStartTagTokenInForeignContent(e) {
    if (!this.currentNotInHTML) return !1;
    let t, a;
    return this.openElements.stackTop === 0 && this.fragmentContext ? (t = this.fragmentContext, a = this.fragmentContextID) : { current: t, currentTagId: a } = this.openElements, e.tagID === s.SVG && this.treeAdapter.getTagName(t) === c.ANNOTATION_XML && this.treeAdapter.getNamespaceURI(t) === h.MATHML ? !1 : this.tokenizer.inForeignNode || (e.tagID === s.MGLYPH || e.tagID === s.MALIGNMARK) && a !== void 0 && !this._isIntegrationPoint(a, t, h.HTML);
  }
  /** @protected */
  _processToken(e) {
    switch (e.type) {
      case d.CHARACTER:
        this.onCharacter(e);
        break;
      case d.NULL_CHARACTER:
        this.onNullCharacter(e);
        break;
      case d.COMMENT:
        this.onComment(e);
        break;
      case d.DOCTYPE:
        this.onDoctype(e);
        break;
      case d.START_TAG:
        this._processStartTag(e);
        break;
      case d.END_TAG:
        this.onEndTag(e);
        break;
      case d.EOF:
        this.onEof(e);
        break;
      case d.WHITESPACE_CHARACTER:
        this.onWhitespaceCharacter(e);
        break;
    }
  }
  /** @protected */
  _isIntegrationPoint(e, t, a) {
    const o = this.treeAdapter.getNamespaceURI(t), T = this.treeAdapter.getAttrList(t);
    return Yt(e, o, T, a);
  }
  /** @protected */
  _reconstructActiveFormattingElements() {
    const e = this.activeFormattingElements.entries.length;
    if (e) {
      const t = this.activeFormattingElements.entries.findIndex((o) => o.type === D.Marker || this.openElements.contains(o.element)), a = t === -1 ? e - 1 : t - 1;
      for (let o = a; o >= 0; o--) {
        const T = this.activeFormattingElements.entries[o];
        this._insertElement(T.token, this.treeAdapter.getNamespaceURI(T.element)), T.element = this.openElements.current;
      }
    }
  }
  /** @protected */
  _closeTableCell() {
    this.openElements.generateImpliedEndTags(), this.openElements.popUntilTableCellPopped(), this.activeFormattingElements.clearToLastMarker(), this.insertionMode = n.IN_ROW;
  }
  /** @protected */
  _closePElement() {
    this.openElements.generateImpliedEndTagsWithExclusion(s.P), this.openElements.popUntilTagNamePopped(s.P);
  }
  /** @protected */
  _resetInsertionMode() {
    for (let e = this.openElements.stackTop; e >= 0; e--) switch (e === 0 && this.fragmentContext ? this.fragmentContextID : this.openElements.tagIDs[e]) {
      case s.TR:
        this.insertionMode = n.IN_ROW;
        return;
      case s.TBODY:
      case s.THEAD:
      case s.TFOOT:
        this.insertionMode = n.IN_TABLE_BODY;
        return;
      case s.CAPTION:
        this.insertionMode = n.IN_CAPTION;
        return;
      case s.COLGROUP:
        this.insertionMode = n.IN_COLUMN_GROUP;
        return;
      case s.TABLE:
        this.insertionMode = n.IN_TABLE;
        return;
      case s.BODY:
        this.insertionMode = n.IN_BODY;
        return;
      case s.FRAMESET:
        this.insertionMode = n.IN_FRAMESET;
        return;
      case s.SELECT:
        this._resetInsertionModeForSelect(e);
        return;
      case s.TEMPLATE:
        this.insertionMode = this.tmplInsertionModeStack[0];
        return;
      case s.HTML:
        this.insertionMode = this.headElement ? n.AFTER_HEAD : n.BEFORE_HEAD;
        return;
      case s.TD:
      case s.TH:
        if (e > 0) {
          this.insertionMode = n.IN_CELL;
          return;
        }
        break;
      case s.HEAD:
        if (e > 0) {
          this.insertionMode = n.IN_HEAD;
          return;
        }
        break;
    }
    this.insertionMode = n.IN_BODY;
  }
  /** @protected */
  _resetInsertionModeForSelect(e) {
    if (e > 0) for (let t = e - 1; t > 0; t--) {
      const a = this.openElements.tagIDs[t];
      if (a === s.TEMPLATE) break;
      if (a === s.TABLE) {
        this.insertionMode = n.IN_SELECT_IN_TABLE;
        return;
      }
    }
    this.insertionMode = n.IN_SELECT;
  }
  /** @protected */
  _isElementCausesFosterParenting(e) {
    return He.has(e);
  }
  /** @protected */
  _shouldFosterParentOnInsertion() {
    return this.fosterParentingEnabled && this.openElements.currentTagId !== void 0 && this._isElementCausesFosterParenting(this.openElements.currentTagId);
  }
  /** @protected */
  _findFosterParentingLocation() {
    for (let e = this.openElements.stackTop; e >= 0; e--) {
      const t = this.openElements.items[e];
      switch (this.openElements.tagIDs[e]) {
        case s.TEMPLATE:
          if (this.treeAdapter.getNamespaceURI(t) === h.HTML) return {
            parent: this.treeAdapter.getTemplateContent(t),
            beforeElement: null
          };
          break;
        case s.TABLE: {
          const a = this.treeAdapter.getParentNode(t);
          return a ? {
            parent: a,
            beforeElement: t
          } : {
            parent: this.openElements.items[e - 1],
            beforeElement: null
          };
        }
      }
    }
    return {
      parent: this.openElements.items[0],
      beforeElement: null
    };
  }
  /** @protected */
  _fosterParentElement(e) {
    const t = this._findFosterParentingLocation();
    t.beforeElement ? this.treeAdapter.insertBefore(t.parent, e, t.beforeElement) : this.treeAdapter.appendChild(t.parent, e);
  }
  /** @protected */
  _isSpecialElement(e, t) {
    return Tt[this.treeAdapter.getNamespaceURI(e)].has(t);
  }
  /** @internal */
  onCharacter(e) {
    if (this.skipNextNewLine = !1, this.tokenizer.inForeignNode) {
      Ca(this, e);
      return;
    }
    switch (this.insertionMode) {
      case n.INITIAL:
        U(this, e);
        break;
      case n.BEFORE_HTML:
        w(this, e);
        break;
      case n.BEFORE_HEAD:
        x(this, e);
        break;
      case n.IN_HEAD:
        Y(this, e);
        break;
      case n.IN_HEAD_NO_SCRIPT:
        v(this, e);
        break;
      case n.AFTER_HEAD:
        Q(this, e);
        break;
      case n.IN_BODY:
      case n.IN_CAPTION:
      case n.IN_CELL:
      case n.IN_TEMPLATE:
        Ue(this, e);
        break;
      case n.TEXT:
      case n.IN_SELECT:
      case n.IN_SELECT_IN_TABLE:
        this._insertCharacters(e);
        break;
      case n.IN_TABLE:
      case n.IN_TABLE_BODY:
      case n.IN_ROW:
        se(this, e);
        break;
      case n.IN_TABLE_TEXT:
        ve(this, e);
        break;
      case n.IN_COLUMN_GROUP:
        V(this, e);
        break;
      case n.AFTER_BODY:
        z(this, e);
        break;
      case n.AFTER_AFTER_BODY:
        K(this, e);
        break;
    }
  }
  /** @internal */
  onNullCharacter(e) {
    if (this.skipNextNewLine = !1, this.tokenizer.inForeignNode) {
      fa(this, e);
      return;
    }
    switch (this.insertionMode) {
      case n.INITIAL:
        U(this, e);
        break;
      case n.BEFORE_HTML:
        w(this, e);
        break;
      case n.BEFORE_HEAD:
        x(this, e);
        break;
      case n.IN_HEAD:
        Y(this, e);
        break;
      case n.IN_HEAD_NO_SCRIPT:
        v(this, e);
        break;
      case n.AFTER_HEAD:
        Q(this, e);
        break;
      case n.TEXT:
        this._insertCharacters(e);
        break;
      case n.IN_TABLE:
      case n.IN_TABLE_BODY:
      case n.IN_ROW:
        se(this, e);
        break;
      case n.IN_COLUMN_GROUP:
        V(this, e);
        break;
      case n.AFTER_BODY:
        z(this, e);
        break;
      case n.AFTER_AFTER_BODY:
        K(this, e);
        break;
    }
  }
  /** @internal */
  onComment(e) {
    if (this.skipNextNewLine = !1, this.currentNotInHTML) {
      ie(this, e);
      return;
    }
    switch (this.insertionMode) {
      case n.INITIAL:
      case n.BEFORE_HTML:
      case n.BEFORE_HEAD:
      case n.IN_HEAD:
      case n.IN_HEAD_NO_SCRIPT:
      case n.AFTER_HEAD:
      case n.IN_BODY:
      case n.IN_TABLE:
      case n.IN_CAPTION:
      case n.IN_COLUMN_GROUP:
      case n.IN_TABLE_BODY:
      case n.IN_ROW:
      case n.IN_CELL:
      case n.IN_SELECT:
      case n.IN_SELECT_IN_TABLE:
      case n.IN_TEMPLATE:
      case n.IN_FRAMESET:
      case n.AFTER_FRAMESET:
        ie(this, e);
        break;
      case n.IN_TABLE_TEXT:
        F(this, e);
        break;
      case n.AFTER_BODY:
        Zt(this, e);
        break;
      case n.AFTER_AFTER_BODY:
      case n.AFTER_AFTER_FRAMESET:
        $t(this, e);
        break;
    }
  }
  /** @internal */
  onDoctype(e) {
    switch (this.skipNextNewLine = !1, this.insertionMode) {
      case n.INITIAL:
        es(this, e);
        break;
      case n.BEFORE_HEAD:
      case n.IN_HEAD:
      case n.IN_HEAD_NO_SCRIPT:
      case n.AFTER_HEAD:
        this._err(e, E.misplacedDoctype);
        break;
      case n.IN_TABLE_TEXT:
        F(this, e);
        break;
    }
  }
  /** @internal */
  onStartTag(e) {
    this.skipNextNewLine = !1, this.currentToken = e, this._processStartTag(e), e.selfClosing && !e.ackSelfClosing && this._err(e, E.nonVoidHtmlElementStartTagWithTrailingSolidus);
  }
  /**
  * Processes a given start tag.
  *
  * `onStartTag` checks if a self-closing tag was recognized. When a token
  * is moved inbetween multiple insertion modes, this check for self-closing
  * could lead to false positives. To avoid this, `_processStartTag` is used
  * for nested calls.
  *
  * @param token The token to process.
  * @protected
  */
  _processStartTag(e) {
    this.shouldProcessStartTagTokenInForeignContent(e) ? Oa(this, e) : this._startTagOutsideForeignContent(e);
  }
  /** @protected */
  _startTagOutsideForeignContent(e) {
    switch (this.insertionMode) {
      case n.INITIAL:
        U(this, e);
        break;
      case n.BEFORE_HTML:
        ts(this, e);
        break;
      case n.BEFORE_HEAD:
        as(this, e);
        break;
      case n.IN_HEAD:
        R(this, e);
        break;
      case n.IN_HEAD_NO_SCRIPT:
        ns(this, e);
        break;
      case n.AFTER_HEAD:
        cs(this, e);
        break;
      case n.IN_BODY:
        f(this, e);
        break;
      case n.IN_TABLE:
        H(this, e);
        break;
      case n.IN_TABLE_TEXT:
        F(this, e);
        break;
      case n.IN_CAPTION:
        ra(this, e);
        break;
      case n.IN_COLUMN_GROUP:
        Te(this, e);
        break;
      case n.IN_TABLE_BODY:
        $(this, e);
        break;
      case n.IN_ROW:
        ee(this, e);
        break;
      case n.IN_CELL:
        oa(this, e);
        break;
      case n.IN_SELECT:
        Ge(this, e);
        break;
      case n.IN_SELECT_IN_TABLE:
        Ea(this, e);
        break;
      case n.IN_TEMPLATE:
        ha(this, e);
        break;
      case n.AFTER_BODY:
        _a(this, e);
        break;
      case n.IN_FRAMESET:
        ma(this, e);
        break;
      case n.AFTER_FRAMESET:
        ua(this, e);
        break;
      case n.AFTER_AFTER_BODY:
        Na(this, e);
        break;
      case n.AFTER_AFTER_FRAMESET:
        Ia(this, e);
        break;
    }
  }
  /** @internal */
  onEndTag(e) {
    this.skipNextNewLine = !1, this.currentToken = e, this.currentNotInHTML ? Sa(this, e) : this._endTagOutsideForeignContent(e);
  }
  /** @protected */
  _endTagOutsideForeignContent(e) {
    switch (this.insertionMode) {
      case n.INITIAL:
        U(this, e);
        break;
      case n.BEFORE_HTML:
        ss(this, e);
        break;
      case n.BEFORE_HEAD:
        rs(this, e);
        break;
      case n.IN_HEAD:
        is(this, e);
        break;
      case n.IN_HEAD_NO_SCRIPT:
        os(this, e);
        break;
      case n.AFTER_HEAD:
        Es(this, e);
        break;
      case n.IN_BODY:
        Z(this, e);
        break;
      case n.TEXT:
        Vs(this, e);
        break;
      case n.IN_TABLE:
        W(this, e);
        break;
      case n.IN_TABLE_TEXT:
        F(this, e);
        break;
      case n.IN_CAPTION:
        ia(this, e);
        break;
      case n.IN_COLUMN_GROUP:
        na(this, e);
        break;
      case n.IN_TABLE_BODY:
        ne(this, e);
        break;
      case n.IN_ROW:
        We(this, e);
        break;
      case n.IN_CELL:
        ca(this, e);
        break;
      case n.IN_SELECT:
        qe(this, e);
        break;
      case n.IN_SELECT_IN_TABLE:
        Ta(this, e);
        break;
      case n.IN_TEMPLATE:
        la(this, e);
        break;
      case n.AFTER_BODY:
        Xe(this, e);
        break;
      case n.IN_FRAMESET:
        da(this, e);
        break;
      case n.AFTER_FRAMESET:
        Aa(this, e);
        break;
      case n.AFTER_AFTER_BODY:
        K(this, e);
        break;
    }
  }
  /** @internal */
  onEof(e) {
    switch (this.insertionMode) {
      case n.INITIAL:
        U(this, e);
        break;
      case n.BEFORE_HTML:
        w(this, e);
        break;
      case n.BEFORE_HEAD:
        x(this, e);
        break;
      case n.IN_HEAD:
        Y(this, e);
        break;
      case n.IN_HEAD_NO_SCRIPT:
        v(this, e);
        break;
      case n.AFTER_HEAD:
        Q(this, e);
        break;
      case n.IN_BODY:
      case n.IN_TABLE:
      case n.IN_CAPTION:
      case n.IN_COLUMN_GROUP:
      case n.IN_TABLE_BODY:
      case n.IN_ROW:
      case n.IN_CELL:
      case n.IN_SELECT:
      case n.IN_SELECT_IN_TABLE:
        xe(this, e);
        break;
      case n.TEXT:
        zs(this, e);
        break;
      case n.IN_TABLE_TEXT:
        F(this, e);
        break;
      case n.IN_TEMPLATE:
        Ke(this, e);
        break;
      case n.AFTER_BODY:
      case n.IN_FRAMESET:
      case n.AFTER_FRAMESET:
      case n.AFTER_AFTER_BODY:
      case n.AFTER_AFTER_FRAMESET:
        Ee(this, e);
        break;
    }
  }
  /** @internal */
  onWhitespaceCharacter(e) {
    if (this.skipNextNewLine && (this.skipNextNewLine = !1, e.chars.charCodeAt(0) === r.LINE_FEED)) {
      if (e.chars.length === 1) return;
      e.chars = e.chars.substr(1);
    }
    if (this.tokenizer.inForeignNode) {
      this._insertCharacters(e);
      return;
    }
    switch (this.insertionMode) {
      case n.IN_HEAD:
      case n.IN_HEAD_NO_SCRIPT:
      case n.AFTER_HEAD:
      case n.TEXT:
      case n.IN_COLUMN_GROUP:
      case n.IN_SELECT:
      case n.IN_SELECT_IN_TABLE:
      case n.IN_FRAMESET:
      case n.AFTER_FRAMESET:
        this._insertCharacters(e);
        break;
      case n.IN_BODY:
      case n.IN_CAPTION:
      case n.IN_CELL:
      case n.IN_TEMPLATE:
      case n.AFTER_BODY:
      case n.AFTER_AFTER_BODY:
      case n.AFTER_AFTER_FRAMESET:
        ke(this, e);
        break;
      case n.IN_TABLE:
      case n.IN_TABLE_BODY:
      case n.IN_ROW:
        se(this, e);
        break;
      case n.IN_TABLE_TEXT:
        Ye(this, e);
        break;
    }
  }
};
function Kt(e, t) {
  let a = e.activeFormattingElements.getElementEntryInScopeWithTagName(t.tagName);
  return a ? e.openElements.contains(a.element) ? e.openElements.hasInScope(t.tagID) || (a = null) : (e.activeFormattingElements.removeEntry(a), a = null) : we(e, t), a;
}
function Xt(e, t) {
  let a = null, o = e.openElements.stackTop;
  for (; o >= 0; o--) {
    const T = e.openElements.items[o];
    if (T === t.element) break;
    e._isSpecialElement(T, e.openElements.tagIDs[o]) && (a = T);
  }
  return a || (e.openElements.shortenToLength(Math.max(o, 0)), e.activeFormattingElements.removeEntry(t)), a;
}
function Vt(e, t, a) {
  let o = t, T = e.openElements.getCommonAncestor(t);
  for (let _ = 0, m = T; m !== a; _++, m = T) {
    T = e.openElements.getCommonAncestor(m);
    const I = e.activeFormattingElements.getElementEntry(m), C = I && _ >= Wt;
    !I || C ? (C && e.activeFormattingElements.removeEntry(I), e.openElements.remove(m)) : (m = zt(e, I), o === t && (e.activeFormattingElements.bookmark = I), e.treeAdapter.detachNode(o), e.treeAdapter.appendChild(m, o), o = m);
  }
  return o;
}
function zt(e, t) {
  const a = e.treeAdapter.getNamespaceURI(t.element), o = e.treeAdapter.createElement(t.token.tagName, a, t.token.attrs);
  return e.openElements.replace(t.element, o), t.element = o, o;
}
function Jt(e, t, a) {
  const o = J(e.treeAdapter.getTagName(t));
  if (e._isElementCausesFosterParenting(o)) e._fosterParentElement(a);
  else {
    const T = e.treeAdapter.getNamespaceURI(t);
    o === s.TEMPLATE && T === h.HTML && (t = e.treeAdapter.getTemplateContent(t)), e.treeAdapter.appendChild(t, a);
  }
}
function jt(e, t, a) {
  const o = e.treeAdapter.getNamespaceURI(a.element), { token: T } = a, _ = e.treeAdapter.createElement(T.tagName, o, T.attrs);
  e._adoptNodes(t, _), e.treeAdapter.appendChild(t, _), e.activeFormattingElements.insertElementAfterBookmark(_, T), e.activeFormattingElements.removeEntry(a), e.openElements.remove(a.element), e.openElements.insertAfter(t, _, T.tagID);
}
function ce(e, t) {
  for (let a = 0; a < Qt; a++) {
    const o = Kt(e, t);
    if (!o) break;
    const T = Xt(e, o);
    if (!T) break;
    e.activeFormattingElements.bookmark = o;
    const _ = Vt(e, T, o.element), m = e.openElements.getCommonAncestor(o.element);
    e.treeAdapter.detachNode(_), m && Jt(e, m, _), jt(e, T, o);
  }
}
function ie(e, t) {
  e._appendCommentNode(t, e.openElements.currentTmplContentOrNode);
}
function Zt(e, t) {
  e._appendCommentNode(t, e.openElements.items[0]);
}
function $t(e, t) {
  e._appendCommentNode(t, e.document);
}
function Ee(e, t) {
  if (e.stopped = !0, t.location) {
    const a = e.fragmentContext ? 0 : 2;
    for (let o = e.openElements.stackTop; o >= a; o--) e._setEndLocation(e.openElements.items[o], t);
    if (!e.fragmentContext && e.openElements.stackTop >= 0) {
      const o = e.openElements.items[0], T = e.treeAdapter.getNodeSourceCodeLocation(o);
      if (T && !T.endTag && (e._setEndLocation(o, t), e.openElements.stackTop >= 1)) {
        const _ = e.openElements.items[1], m = e.treeAdapter.getNodeSourceCodeLocation(_);
        m && !m.endTag && e._setEndLocation(_, t);
      }
    }
  }
}
function es(e, t) {
  e._setDocumentType(t);
  const a = t.forceQuirks ? L.QUIRKS : Pt(t);
  gt(t) || e._err(t, E.nonConformingDoctype), e.treeAdapter.setDocumentMode(e.document, a), e.insertionMode = n.BEFORE_HTML;
}
function U(e, t) {
  e._err(t, E.missingDoctype, !0), e.treeAdapter.setDocumentMode(e.document, L.QUIRKS), e.insertionMode = n.BEFORE_HTML, e._processToken(t);
}
function ts(e, t) {
  t.tagID === s.HTML ? (e._insertElement(t, h.HTML), e.insertionMode = n.BEFORE_HEAD) : w(e, t);
}
function ss(e, t) {
  const a = t.tagID;
  (a === s.HTML || a === s.HEAD || a === s.BODY || a === s.BR) && w(e, t);
}
function w(e, t) {
  e._insertFakeRootElement(), e.insertionMode = n.BEFORE_HEAD, e._processToken(t);
}
function as(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.HEAD:
      e._insertElement(t, h.HTML), e.headElement = e.openElements.current, e.insertionMode = n.IN_HEAD;
      break;
    default:
      x(e, t);
  }
}
function rs(e, t) {
  const a = t.tagID;
  a === s.HEAD || a === s.BODY || a === s.HTML || a === s.BR ? x(e, t) : e._err(t, E.endTagWithoutMatchingOpenElement);
}
function x(e, t) {
  e._insertFakeElement(c.HEAD, s.HEAD), e.headElement = e.openElements.current, e.insertionMode = n.IN_HEAD, e._processToken(t);
}
function R(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.BASE:
    case s.BASEFONT:
    case s.BGSOUND:
    case s.LINK:
    case s.META:
      e._appendElement(t, h.HTML), t.ackSelfClosing = !0;
      break;
    case s.TITLE:
      e._switchToTextParsing(t, S.RCDATA);
      break;
    case s.NOSCRIPT:
      e.options.scriptingEnabled ? e._switchToTextParsing(t, S.RAWTEXT) : (e._insertElement(t, h.HTML), e.insertionMode = n.IN_HEAD_NO_SCRIPT);
      break;
    case s.NOFRAMES:
    case s.STYLE:
      e._switchToTextParsing(t, S.RAWTEXT);
      break;
    case s.SCRIPT:
      e._switchToTextParsing(t, S.SCRIPT_DATA);
      break;
    case s.TEMPLATE:
      e._insertTemplate(t), e.activeFormattingElements.insertMarker(), e.framesetOk = !1, e.insertionMode = n.IN_TEMPLATE, e.tmplInsertionModeStack.unshift(n.IN_TEMPLATE);
      break;
    case s.HEAD:
      e._err(t, E.misplacedStartTagForHeadElement);
      break;
    default:
      Y(e, t);
  }
}
function is(e, t) {
  switch (t.tagID) {
    case s.HEAD:
      e.openElements.pop(), e.insertionMode = n.AFTER_HEAD;
      break;
    case s.BODY:
    case s.BR:
    case s.HTML:
      Y(e, t);
      break;
    case s.TEMPLATE:
      B(e, t);
      break;
    default:
      e._err(t, E.endTagWithoutMatchingOpenElement);
  }
}
function B(e, t) {
  e.openElements.tmplCount > 0 ? (e.openElements.generateImpliedEndTagsThoroughly(), e.openElements.currentTagId !== s.TEMPLATE && e._err(t, E.closingOfElementWithOpenChildElements), e.openElements.popUntilTagNamePopped(s.TEMPLATE), e.activeFormattingElements.clearToLastMarker(), e.tmplInsertionModeStack.shift(), e._resetInsertionMode()) : e._err(t, E.endTagWithoutMatchingOpenElement);
}
function Y(e, t) {
  e.openElements.pop(), e.insertionMode = n.AFTER_HEAD, e._processToken(t);
}
function ns(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.BASEFONT:
    case s.BGSOUND:
    case s.HEAD:
    case s.LINK:
    case s.META:
    case s.NOFRAMES:
    case s.STYLE:
      R(e, t);
      break;
    case s.NOSCRIPT:
      e._err(t, E.nestedNoscriptInHead);
      break;
    default:
      v(e, t);
  }
}
function os(e, t) {
  switch (t.tagID) {
    case s.NOSCRIPT:
      e.openElements.pop(), e.insertionMode = n.IN_HEAD;
      break;
    case s.BR:
      v(e, t);
      break;
    default:
      e._err(t, E.endTagWithoutMatchingOpenElement);
  }
}
function v(e, t) {
  e._err(t, t.type === d.EOF ? E.openElementsLeftAfterEof : E.disallowedContentInNoscriptInHead), e.openElements.pop(), e.insertionMode = n.IN_HEAD, e._processToken(t);
}
function cs(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.BODY:
      e._insertElement(t, h.HTML), e.framesetOk = !1, e.insertionMode = n.IN_BODY;
      break;
    case s.FRAMESET:
      e._insertElement(t, h.HTML), e.insertionMode = n.IN_FRAMESET;
      break;
    case s.BASE:
    case s.BASEFONT:
    case s.BGSOUND:
    case s.LINK:
    case s.META:
    case s.NOFRAMES:
    case s.SCRIPT:
    case s.STYLE:
    case s.TEMPLATE:
    case s.TITLE:
      e._err(t, E.abandonedHeadElementChild), e.openElements.push(e.headElement, s.HEAD), R(e, t), e.openElements.remove(e.headElement);
      break;
    case s.HEAD:
      e._err(t, E.misplacedStartTagForHeadElement);
      break;
    default:
      Q(e, t);
  }
}
function Es(e, t) {
  switch (t.tagID) {
    case s.BODY:
    case s.HTML:
    case s.BR:
      Q(e, t);
      break;
    case s.TEMPLATE:
      B(e, t);
      break;
    default:
      e._err(t, E.endTagWithoutMatchingOpenElement);
  }
}
function Q(e, t) {
  e._insertFakeElement(c.BODY, s.BODY), e.insertionMode = n.IN_BODY, j(e, t);
}
function j(e, t) {
  switch (t.type) {
    case d.CHARACTER:
      Ue(e, t);
      break;
    case d.WHITESPACE_CHARACTER:
      ke(e, t);
      break;
    case d.COMMENT:
      ie(e, t);
      break;
    case d.START_TAG:
      f(e, t);
      break;
    case d.END_TAG:
      Z(e, t);
      break;
    case d.EOF:
      xe(e, t);
      break;
  }
}
function ke(e, t) {
  e._reconstructActiveFormattingElements(), e._insertCharacters(t);
}
function Ue(e, t) {
  e._reconstructActiveFormattingElements(), e._insertCharacters(t), e.framesetOk = !1;
}
function Ts(e, t) {
  e.openElements.tmplCount === 0 && e.treeAdapter.adoptAttributes(e.openElements.items[0], t.attrs);
}
function hs(e, t) {
  const a = e.openElements.tryPeekProperlyNestedBodyElement();
  a && e.openElements.tmplCount === 0 && (e.framesetOk = !1, e.treeAdapter.adoptAttributes(a, t.attrs));
}
function ls(e, t) {
  const a = e.openElements.tryPeekProperlyNestedBodyElement();
  e.framesetOk && a && (e.treeAdapter.detachNode(a), e.openElements.popAllUpToHtmlElement(), e._insertElement(t, h.HTML), e.insertionMode = n.IN_FRAMESET);
}
function _s(e, t) {
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._insertElement(t, h.HTML);
}
function ms(e, t) {
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e.openElements.currentTagId !== void 0 && re.has(e.openElements.currentTagId) && e.openElements.pop(), e._insertElement(t, h.HTML);
}
function ds(e, t) {
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._insertElement(t, h.HTML), e.skipNextNewLine = !0, e.framesetOk = !1;
}
function us(e, t) {
  const a = e.openElements.tmplCount > 0;
  (!e.formElement || a) && (e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._insertElement(t, h.HTML), a || (e.formElement = e.openElements.current));
}
function As(e, t) {
  e.framesetOk = !1;
  const a = t.tagID;
  for (let o = e.openElements.stackTop; o >= 0; o--) {
    const T = e.openElements.tagIDs[o];
    if (a === s.LI && T === s.LI || (a === s.DD || a === s.DT) && (T === s.DD || T === s.DT)) {
      e.openElements.generateImpliedEndTagsWithExclusion(T), e.openElements.popUntilTagNamePopped(T);
      break;
    }
    if (T !== s.ADDRESS && T !== s.DIV && T !== s.P && e._isSpecialElement(e.openElements.items[o], T)) break;
  }
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._insertElement(t, h.HTML);
}
function Ns(e, t) {
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._insertElement(t, h.HTML), e.tokenizer.state = S.PLAINTEXT;
}
function Is(e, t) {
  e.openElements.hasInScope(s.BUTTON) && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilTagNamePopped(s.BUTTON)), e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML), e.framesetOk = !1;
}
function fs(e, t) {
  const a = e.activeFormattingElements.getElementEntryInScopeWithTagName(c.A);
  a && (ce(e, t), e.openElements.remove(a.element), e.activeFormattingElements.removeEntry(a)), e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML), e.activeFormattingElements.pushElement(e.openElements.current, t);
}
function Cs(e, t) {
  e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML), e.activeFormattingElements.pushElement(e.openElements.current, t);
}
function Os(e, t) {
  e._reconstructActiveFormattingElements(), e.openElements.hasInScope(s.NOBR) && (ce(e, t), e._reconstructActiveFormattingElements()), e._insertElement(t, h.HTML), e.activeFormattingElements.pushElement(e.openElements.current, t);
}
function Ss(e, t) {
  e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML), e.activeFormattingElements.insertMarker(), e.framesetOk = !1;
}
function Ls(e, t) {
  e.treeAdapter.getDocumentMode(e.document) !== L.QUIRKS && e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._insertElement(t, h.HTML), e.framesetOk = !1, e.insertionMode = n.IN_TABLE;
}
function Fe(e, t) {
  e._reconstructActiveFormattingElements(), e._appendElement(t, h.HTML), e.framesetOk = !1, t.ackSelfClosing = !0;
}
function ye(e) {
  const t = Re(e, M.TYPE);
  return t != null && t.toLowerCase() === vt;
}
function Rs(e, t) {
  e._reconstructActiveFormattingElements(), e._appendElement(t, h.HTML), ye(t) || (e.framesetOk = !1), t.ackSelfClosing = !0;
}
function Ds(e, t) {
  e._appendElement(t, h.HTML), t.ackSelfClosing = !0;
}
function ps(e, t) {
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._appendElement(t, h.HTML), e.framesetOk = !1, t.ackSelfClosing = !0;
}
function gs(e, t) {
  t.tagName = c.IMG, t.tagID = s.IMG, Fe(e, t);
}
function Ps(e, t) {
  e._insertElement(t, h.HTML), e.skipNextNewLine = !0, e.tokenizer.state = S.RCDATA, e.originalInsertionMode = e.insertionMode, e.framesetOk = !1, e.insertionMode = n.TEXT;
}
function bs(e, t) {
  e.openElements.hasInButtonScope(s.P) && e._closePElement(), e._reconstructActiveFormattingElements(), e.framesetOk = !1, e._switchToTextParsing(t, S.RAWTEXT);
}
function Ms(e, t) {
  e.framesetOk = !1, e._switchToTextParsing(t, S.RAWTEXT);
}
function fe(e, t) {
  e._switchToTextParsing(t, S.RAWTEXT);
}
function Bs(e, t) {
  e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML), e.framesetOk = !1, e.insertionMode = e.insertionMode === n.IN_TABLE || e.insertionMode === n.IN_CAPTION || e.insertionMode === n.IN_TABLE_BODY || e.insertionMode === n.IN_ROW || e.insertionMode === n.IN_CELL ? n.IN_SELECT_IN_TABLE : n.IN_SELECT;
}
function Hs(e, t) {
  e.openElements.currentTagId === s.OPTION && e.openElements.pop(), e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML);
}
function ks(e, t) {
  e.openElements.hasInScope(s.RUBY) && e.openElements.generateImpliedEndTags(), e._insertElement(t, h.HTML);
}
function Us(e, t) {
  e.openElements.hasInScope(s.RUBY) && e.openElements.generateImpliedEndTagsWithExclusion(s.RTC), e._insertElement(t, h.HTML);
}
function Fs(e, t) {
  e._reconstructActiveFormattingElements(), Me(t), oe(t), t.selfClosing ? e._appendElement(t, h.MATHML) : e._insertElement(t, h.MATHML), t.ackSelfClosing = !0;
}
function ys(e, t) {
  e._reconstructActiveFormattingElements(), Be(t), oe(t), t.selfClosing ? e._appendElement(t, h.SVG) : e._insertElement(t, h.SVG), t.ackSelfClosing = !0;
}
function Ce(e, t) {
  e._reconstructActiveFormattingElements(), e._insertElement(t, h.HTML);
}
function f(e, t) {
  switch (t.tagID) {
    case s.I:
    case s.S:
    case s.B:
    case s.U:
    case s.EM:
    case s.TT:
    case s.BIG:
    case s.CODE:
    case s.FONT:
    case s.SMALL:
    case s.STRIKE:
    case s.STRONG:
      Cs(e, t);
      break;
    case s.A:
      fs(e, t);
      break;
    case s.H1:
    case s.H2:
    case s.H3:
    case s.H4:
    case s.H5:
    case s.H6:
      ms(e, t);
      break;
    case s.P:
    case s.DL:
    case s.OL:
    case s.UL:
    case s.DIV:
    case s.DIR:
    case s.NAV:
    case s.MAIN:
    case s.MENU:
    case s.ASIDE:
    case s.CENTER:
    case s.FIGURE:
    case s.FOOTER:
    case s.HEADER:
    case s.HGROUP:
    case s.DIALOG:
    case s.DETAILS:
    case s.ADDRESS:
    case s.ARTICLE:
    case s.SEARCH:
    case s.SECTION:
    case s.SUMMARY:
    case s.FIELDSET:
    case s.BLOCKQUOTE:
    case s.FIGCAPTION:
      _s(e, t);
      break;
    case s.LI:
    case s.DD:
    case s.DT:
      As(e, t);
      break;
    case s.BR:
    case s.IMG:
    case s.WBR:
    case s.AREA:
    case s.EMBED:
    case s.KEYGEN:
      Fe(e, t);
      break;
    case s.HR:
      ps(e, t);
      break;
    case s.RB:
    case s.RTC:
      ks(e, t);
      break;
    case s.RT:
    case s.RP:
      Us(e, t);
      break;
    case s.PRE:
    case s.LISTING:
      ds(e, t);
      break;
    case s.XMP:
      bs(e, t);
      break;
    case s.SVG:
      ys(e, t);
      break;
    case s.HTML:
      Ts(e, t);
      break;
    case s.BASE:
    case s.LINK:
    case s.META:
    case s.STYLE:
    case s.TITLE:
    case s.SCRIPT:
    case s.BGSOUND:
    case s.BASEFONT:
    case s.TEMPLATE:
      R(e, t);
      break;
    case s.BODY:
      hs(e, t);
      break;
    case s.FORM:
      us(e, t);
      break;
    case s.NOBR:
      Os(e, t);
      break;
    case s.MATH:
      Fs(e, t);
      break;
    case s.TABLE:
      Ls(e, t);
      break;
    case s.INPUT:
      Rs(e, t);
      break;
    case s.PARAM:
    case s.TRACK:
    case s.SOURCE:
      Ds(e, t);
      break;
    case s.IMAGE:
      gs(e, t);
      break;
    case s.BUTTON:
      Is(e, t);
      break;
    case s.APPLET:
    case s.OBJECT:
    case s.MARQUEE:
      Ss(e, t);
      break;
    case s.IFRAME:
      Ms(e, t);
      break;
    case s.SELECT:
      Bs(e, t);
      break;
    case s.OPTION:
    case s.OPTGROUP:
      Hs(e, t);
      break;
    case s.NOEMBED:
    case s.NOFRAMES:
      fe(e, t);
      break;
    case s.FRAMESET:
      ls(e, t);
      break;
    case s.TEXTAREA:
      Ps(e, t);
      break;
    case s.NOSCRIPT:
      e.options.scriptingEnabled ? fe(e, t) : Ce(e, t);
      break;
    case s.PLAINTEXT:
      Ns(e, t);
      break;
    case s.COL:
    case s.TH:
    case s.TD:
    case s.TR:
    case s.HEAD:
    case s.FRAME:
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
    case s.CAPTION:
    case s.COLGROUP:
      break;
    default:
      Ce(e, t);
  }
}
function ws(e, t) {
  if (e.openElements.hasInScope(s.BODY) && (e.insertionMode = n.AFTER_BODY, e.options.sourceCodeLocationInfo)) {
    const a = e.openElements.tryPeekProperlyNestedBodyElement();
    a && e._setEndLocation(a, t);
  }
}
function xs(e, t) {
  e.openElements.hasInScope(s.BODY) && (e.insertionMode = n.AFTER_BODY, Xe(e, t));
}
function Ys(e, t) {
  const a = t.tagID;
  e.openElements.hasInScope(a) && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilTagNamePopped(a));
}
function vs(e) {
  const t = e.openElements.tmplCount > 0, { formElement: a } = e;
  t || (e.formElement = null), (a || t) && e.openElements.hasInScope(s.FORM) && (e.openElements.generateImpliedEndTags(), t ? e.openElements.popUntilTagNamePopped(s.FORM) : a && e.openElements.remove(a));
}
function Qs(e) {
  e.openElements.hasInButtonScope(s.P) || e._insertFakeElement(c.P, s.P), e._closePElement();
}
function Ws(e) {
  e.openElements.hasInListItemScope(s.LI) && (e.openElements.generateImpliedEndTagsWithExclusion(s.LI), e.openElements.popUntilTagNamePopped(s.LI));
}
function Gs(e, t) {
  const a = t.tagID;
  e.openElements.hasInScope(a) && (e.openElements.generateImpliedEndTagsWithExclusion(a), e.openElements.popUntilTagNamePopped(a));
}
function qs(e) {
  e.openElements.hasNumberedHeaderInScope() && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilNumberedHeaderPopped());
}
function Ks(e, t) {
  const a = t.tagID;
  e.openElements.hasInScope(a) && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilTagNamePopped(a), e.activeFormattingElements.clearToLastMarker());
}
function Xs(e) {
  e._reconstructActiveFormattingElements(), e._insertFakeElement(c.BR, s.BR), e.openElements.pop(), e.framesetOk = !1;
}
function we(e, t) {
  const a = t.tagName, o = t.tagID;
  for (let T = e.openElements.stackTop; T > 0; T--) {
    const _ = e.openElements.items[T], m = e.openElements.tagIDs[T];
    if (o === m && (o !== s.UNKNOWN || e.treeAdapter.getTagName(_) === a)) {
      e.openElements.generateImpliedEndTagsWithExclusion(o), e.openElements.stackTop >= T && e.openElements.shortenToLength(T);
      break;
    }
    if (e._isSpecialElement(_, m)) break;
  }
}
function Z(e, t) {
  switch (t.tagID) {
    case s.A:
    case s.B:
    case s.I:
    case s.S:
    case s.U:
    case s.EM:
    case s.TT:
    case s.BIG:
    case s.CODE:
    case s.FONT:
    case s.NOBR:
    case s.SMALL:
    case s.STRIKE:
    case s.STRONG:
      ce(e, t);
      break;
    case s.P:
      Qs(e);
      break;
    case s.DL:
    case s.UL:
    case s.OL:
    case s.DIR:
    case s.DIV:
    case s.NAV:
    case s.PRE:
    case s.MAIN:
    case s.MENU:
    case s.ASIDE:
    case s.BUTTON:
    case s.CENTER:
    case s.FIGURE:
    case s.FOOTER:
    case s.HEADER:
    case s.HGROUP:
    case s.DIALOG:
    case s.ADDRESS:
    case s.ARTICLE:
    case s.DETAILS:
    case s.SEARCH:
    case s.SECTION:
    case s.SUMMARY:
    case s.LISTING:
    case s.FIELDSET:
    case s.BLOCKQUOTE:
    case s.FIGCAPTION:
      Ys(e, t);
      break;
    case s.LI:
      Ws(e);
      break;
    case s.DD:
    case s.DT:
      Gs(e, t);
      break;
    case s.H1:
    case s.H2:
    case s.H3:
    case s.H4:
    case s.H5:
    case s.H6:
      qs(e);
      break;
    case s.BR:
      Xs(e);
      break;
    case s.BODY:
      ws(e, t);
      break;
    case s.HTML:
      xs(e, t);
      break;
    case s.FORM:
      vs(e);
      break;
    case s.APPLET:
    case s.OBJECT:
    case s.MARQUEE:
      Ks(e, t);
      break;
    case s.TEMPLATE:
      B(e, t);
      break;
    default:
      we(e, t);
  }
}
function xe(e, t) {
  e.tmplInsertionModeStack.length > 0 ? Ke(e, t) : Ee(e, t);
}
function Vs(e, t) {
  var a;
  t.tagID === s.SCRIPT && ((a = e.scriptHandler) === null || a === void 0 || a.call(e, e.openElements.current)), e.openElements.pop(), e.insertionMode = e.originalInsertionMode;
}
function zs(e, t) {
  e._err(t, E.eofInElementThatCanContainOnlyText), e.openElements.pop(), e.insertionMode = e.originalInsertionMode, e.onEof(t);
}
function se(e, t) {
  if (e.openElements.currentTagId !== void 0 && He.has(e.openElements.currentTagId))
    switch (e.pendingCharacterTokens.length = 0, e.hasNonWhitespacePendingCharacterToken = !1, e.originalInsertionMode = e.insertionMode, e.insertionMode = n.IN_TABLE_TEXT, t.type) {
      case d.CHARACTER:
        ve(e, t);
        break;
      case d.WHITESPACE_CHARACTER:
        Ye(e, t);
        break;
    }
  else G(e, t);
}
function Js(e, t) {
  e.openElements.clearBackToTableContext(), e.activeFormattingElements.insertMarker(), e._insertElement(t, h.HTML), e.insertionMode = n.IN_CAPTION;
}
function js(e, t) {
  e.openElements.clearBackToTableContext(), e._insertElement(t, h.HTML), e.insertionMode = n.IN_COLUMN_GROUP;
}
function Zs(e, t) {
  e.openElements.clearBackToTableContext(), e._insertFakeElement(c.COLGROUP, s.COLGROUP), e.insertionMode = n.IN_COLUMN_GROUP, Te(e, t);
}
function $s(e, t) {
  e.openElements.clearBackToTableContext(), e._insertElement(t, h.HTML), e.insertionMode = n.IN_TABLE_BODY;
}
function ea(e, t) {
  e.openElements.clearBackToTableContext(), e._insertFakeElement(c.TBODY, s.TBODY), e.insertionMode = n.IN_TABLE_BODY, $(e, t);
}
function ta(e, t) {
  e.openElements.hasInTableScope(s.TABLE) && (e.openElements.popUntilTagNamePopped(s.TABLE), e._resetInsertionMode(), e._processStartTag(t));
}
function sa(e, t) {
  ye(t) ? e._appendElement(t, h.HTML) : G(e, t), t.ackSelfClosing = !0;
}
function aa(e, t) {
  !e.formElement && e.openElements.tmplCount === 0 && (e._insertElement(t, h.HTML), e.formElement = e.openElements.current, e.openElements.pop());
}
function H(e, t) {
  switch (t.tagID) {
    case s.TD:
    case s.TH:
    case s.TR:
      ea(e, t);
      break;
    case s.STYLE:
    case s.SCRIPT:
    case s.TEMPLATE:
      R(e, t);
      break;
    case s.COL:
      Zs(e, t);
      break;
    case s.FORM:
      aa(e, t);
      break;
    case s.TABLE:
      ta(e, t);
      break;
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
      $s(e, t);
      break;
    case s.INPUT:
      sa(e, t);
      break;
    case s.CAPTION:
      Js(e, t);
      break;
    case s.COLGROUP:
      js(e, t);
      break;
    default:
      G(e, t);
  }
}
function W(e, t) {
  switch (t.tagID) {
    case s.TABLE:
      e.openElements.hasInTableScope(s.TABLE) && (e.openElements.popUntilTagNamePopped(s.TABLE), e._resetInsertionMode());
      break;
    case s.TEMPLATE:
      B(e, t);
      break;
    case s.BODY:
    case s.CAPTION:
    case s.COL:
    case s.COLGROUP:
    case s.HTML:
    case s.TBODY:
    case s.TD:
    case s.TFOOT:
    case s.TH:
    case s.THEAD:
    case s.TR:
      break;
    default:
      G(e, t);
  }
}
function G(e, t) {
  const a = e.fosterParentingEnabled;
  e.fosterParentingEnabled = !0, j(e, t), e.fosterParentingEnabled = a;
}
function Ye(e, t) {
  e.pendingCharacterTokens.push(t);
}
function ve(e, t) {
  e.pendingCharacterTokens.push(t), e.hasNonWhitespacePendingCharacterToken = !0;
}
function F(e, t) {
  let a = 0;
  if (e.hasNonWhitespacePendingCharacterToken) for (; a < e.pendingCharacterTokens.length; a++) G(e, e.pendingCharacterTokens[a]);
  else for (; a < e.pendingCharacterTokens.length; a++) e._insertCharacters(e.pendingCharacterTokens[a]);
  e.insertionMode = e.originalInsertionMode, e._processToken(t);
}
const Qe = /* @__PURE__ */ new Set([
  s.CAPTION,
  s.COL,
  s.COLGROUP,
  s.TBODY,
  s.TD,
  s.TFOOT,
  s.TH,
  s.THEAD,
  s.TR
]);
function ra(e, t) {
  Qe.has(t.tagID) ? e.openElements.hasInTableScope(s.CAPTION) && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilTagNamePopped(s.CAPTION), e.activeFormattingElements.clearToLastMarker(), e.insertionMode = n.IN_TABLE, H(e, t)) : f(e, t);
}
function ia(e, t) {
  const a = t.tagID;
  switch (a) {
    case s.CAPTION:
    case s.TABLE:
      e.openElements.hasInTableScope(s.CAPTION) && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilTagNamePopped(s.CAPTION), e.activeFormattingElements.clearToLastMarker(), e.insertionMode = n.IN_TABLE, a === s.TABLE && W(e, t));
      break;
    case s.BODY:
    case s.COL:
    case s.COLGROUP:
    case s.HTML:
    case s.TBODY:
    case s.TD:
    case s.TFOOT:
    case s.TH:
    case s.THEAD:
    case s.TR:
      break;
    default:
      Z(e, t);
  }
}
function Te(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.COL:
      e._appendElement(t, h.HTML), t.ackSelfClosing = !0;
      break;
    case s.TEMPLATE:
      R(e, t);
      break;
    default:
      V(e, t);
  }
}
function na(e, t) {
  switch (t.tagID) {
    case s.COLGROUP:
      e.openElements.currentTagId === s.COLGROUP && (e.openElements.pop(), e.insertionMode = n.IN_TABLE);
      break;
    case s.TEMPLATE:
      B(e, t);
      break;
    case s.COL:
      break;
    default:
      V(e, t);
  }
}
function V(e, t) {
  e.openElements.currentTagId === s.COLGROUP && (e.openElements.pop(), e.insertionMode = n.IN_TABLE, e._processToken(t));
}
function $(e, t) {
  switch (t.tagID) {
    case s.TR:
      e.openElements.clearBackToTableBodyContext(), e._insertElement(t, h.HTML), e.insertionMode = n.IN_ROW;
      break;
    case s.TH:
    case s.TD:
      e.openElements.clearBackToTableBodyContext(), e._insertFakeElement(c.TR, s.TR), e.insertionMode = n.IN_ROW, ee(e, t);
      break;
    case s.CAPTION:
    case s.COL:
    case s.COLGROUP:
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
      e.openElements.hasTableBodyContextInTableScope() && (e.openElements.clearBackToTableBodyContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE, H(e, t));
      break;
    default:
      H(e, t);
  }
}
function ne(e, t) {
  const a = t.tagID;
  switch (t.tagID) {
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
      e.openElements.hasInTableScope(a) && (e.openElements.clearBackToTableBodyContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE);
      break;
    case s.TABLE:
      e.openElements.hasTableBodyContextInTableScope() && (e.openElements.clearBackToTableBodyContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE, W(e, t));
      break;
    case s.BODY:
    case s.CAPTION:
    case s.COL:
    case s.COLGROUP:
    case s.HTML:
    case s.TD:
    case s.TH:
    case s.TR:
      break;
    default:
      W(e, t);
  }
}
function ee(e, t) {
  switch (t.tagID) {
    case s.TH:
    case s.TD:
      e.openElements.clearBackToTableRowContext(), e._insertElement(t, h.HTML), e.insertionMode = n.IN_CELL, e.activeFormattingElements.insertMarker();
      break;
    case s.CAPTION:
    case s.COL:
    case s.COLGROUP:
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
    case s.TR:
      e.openElements.hasInTableScope(s.TR) && (e.openElements.clearBackToTableRowContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE_BODY, $(e, t));
      break;
    default:
      H(e, t);
  }
}
function We(e, t) {
  switch (t.tagID) {
    case s.TR:
      e.openElements.hasInTableScope(s.TR) && (e.openElements.clearBackToTableRowContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE_BODY);
      break;
    case s.TABLE:
      e.openElements.hasInTableScope(s.TR) && (e.openElements.clearBackToTableRowContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE_BODY, ne(e, t));
      break;
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
      (e.openElements.hasInTableScope(t.tagID) || e.openElements.hasInTableScope(s.TR)) && (e.openElements.clearBackToTableRowContext(), e.openElements.pop(), e.insertionMode = n.IN_TABLE_BODY, ne(e, t));
      break;
    case s.BODY:
    case s.CAPTION:
    case s.COL:
    case s.COLGROUP:
    case s.HTML:
    case s.TD:
    case s.TH:
      break;
    default:
      W(e, t);
  }
}
function oa(e, t) {
  Qe.has(t.tagID) ? (e.openElements.hasInTableScope(s.TD) || e.openElements.hasInTableScope(s.TH)) && (e._closeTableCell(), ee(e, t)) : f(e, t);
}
function ca(e, t) {
  const a = t.tagID;
  switch (a) {
    case s.TD:
    case s.TH:
      e.openElements.hasInTableScope(a) && (e.openElements.generateImpliedEndTags(), e.openElements.popUntilTagNamePopped(a), e.activeFormattingElements.clearToLastMarker(), e.insertionMode = n.IN_ROW);
      break;
    case s.TABLE:
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
    case s.TR:
      e.openElements.hasInTableScope(a) && (e._closeTableCell(), We(e, t));
      break;
    case s.BODY:
    case s.CAPTION:
    case s.COL:
    case s.COLGROUP:
    case s.HTML:
      break;
    default:
      Z(e, t);
  }
}
function Ge(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.OPTION:
      e.openElements.currentTagId === s.OPTION && e.openElements.pop(), e._insertElement(t, h.HTML);
      break;
    case s.OPTGROUP:
      e.openElements.currentTagId === s.OPTION && e.openElements.pop(), e.openElements.currentTagId === s.OPTGROUP && e.openElements.pop(), e._insertElement(t, h.HTML);
      break;
    case s.HR:
      e.openElements.currentTagId === s.OPTION && e.openElements.pop(), e.openElements.currentTagId === s.OPTGROUP && e.openElements.pop(), e._appendElement(t, h.HTML), t.ackSelfClosing = !0;
      break;
    case s.INPUT:
    case s.KEYGEN:
    case s.TEXTAREA:
    case s.SELECT:
      e.openElements.hasInSelectScope(s.SELECT) && (e.openElements.popUntilTagNamePopped(s.SELECT), e._resetInsertionMode(), t.tagID !== s.SELECT && e._processStartTag(t));
      break;
    case s.SCRIPT:
    case s.TEMPLATE:
      R(e, t);
      break;
  }
}
function qe(e, t) {
  switch (t.tagID) {
    case s.OPTGROUP:
      e.openElements.stackTop > 0 && e.openElements.currentTagId === s.OPTION && e.openElements.tagIDs[e.openElements.stackTop - 1] === s.OPTGROUP && e.openElements.pop(), e.openElements.currentTagId === s.OPTGROUP && e.openElements.pop();
      break;
    case s.OPTION:
      e.openElements.currentTagId === s.OPTION && e.openElements.pop();
      break;
    case s.SELECT:
      e.openElements.hasInSelectScope(s.SELECT) && (e.openElements.popUntilTagNamePopped(s.SELECT), e._resetInsertionMode());
      break;
    case s.TEMPLATE:
      B(e, t);
      break;
  }
}
function Ea(e, t) {
  const a = t.tagID;
  a === s.CAPTION || a === s.TABLE || a === s.TBODY || a === s.TFOOT || a === s.THEAD || a === s.TR || a === s.TD || a === s.TH ? (e.openElements.popUntilTagNamePopped(s.SELECT), e._resetInsertionMode(), e._processStartTag(t)) : Ge(e, t);
}
function Ta(e, t) {
  const a = t.tagID;
  a === s.CAPTION || a === s.TABLE || a === s.TBODY || a === s.TFOOT || a === s.THEAD || a === s.TR || a === s.TD || a === s.TH ? e.openElements.hasInTableScope(a) && (e.openElements.popUntilTagNamePopped(s.SELECT), e._resetInsertionMode(), e.onEndTag(t)) : qe(e, t);
}
function ha(e, t) {
  switch (t.tagID) {
    case s.BASE:
    case s.BASEFONT:
    case s.BGSOUND:
    case s.LINK:
    case s.META:
    case s.NOFRAMES:
    case s.SCRIPT:
    case s.STYLE:
    case s.TEMPLATE:
    case s.TITLE:
      R(e, t);
      break;
    case s.CAPTION:
    case s.COLGROUP:
    case s.TBODY:
    case s.TFOOT:
    case s.THEAD:
      e.tmplInsertionModeStack[0] = n.IN_TABLE, e.insertionMode = n.IN_TABLE, H(e, t);
      break;
    case s.COL:
      e.tmplInsertionModeStack[0] = n.IN_COLUMN_GROUP, e.insertionMode = n.IN_COLUMN_GROUP, Te(e, t);
      break;
    case s.TR:
      e.tmplInsertionModeStack[0] = n.IN_TABLE_BODY, e.insertionMode = n.IN_TABLE_BODY, $(e, t);
      break;
    case s.TD:
    case s.TH:
      e.tmplInsertionModeStack[0] = n.IN_ROW, e.insertionMode = n.IN_ROW, ee(e, t);
      break;
    default:
      e.tmplInsertionModeStack[0] = n.IN_BODY, e.insertionMode = n.IN_BODY, f(e, t);
  }
}
function la(e, t) {
  t.tagID === s.TEMPLATE && B(e, t);
}
function Ke(e, t) {
  e.openElements.tmplCount > 0 ? (e.openElements.popUntilTagNamePopped(s.TEMPLATE), e.activeFormattingElements.clearToLastMarker(), e.tmplInsertionModeStack.shift(), e._resetInsertionMode(), e.onEof(t)) : Ee(e, t);
}
function _a(e, t) {
  t.tagID === s.HTML ? f(e, t) : z(e, t);
}
function Xe(e, t) {
  var a;
  if (t.tagID === s.HTML) {
    if (e.fragmentContext || (e.insertionMode = n.AFTER_AFTER_BODY), e.options.sourceCodeLocationInfo && e.openElements.tagIDs[0] === s.HTML) {
      e._setEndLocation(e.openElements.items[0], t);
      const o = e.openElements.items[1];
      o && !(!((a = e.treeAdapter.getNodeSourceCodeLocation(o)) === null || a === void 0) && a.endTag) && e._setEndLocation(o, t);
    }
  } else z(e, t);
}
function z(e, t) {
  e.insertionMode = n.IN_BODY, j(e, t);
}
function ma(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.FRAMESET:
      e._insertElement(t, h.HTML);
      break;
    case s.FRAME:
      e._appendElement(t, h.HTML), t.ackSelfClosing = !0;
      break;
    case s.NOFRAMES:
      R(e, t);
      break;
  }
}
function da(e, t) {
  t.tagID === s.FRAMESET && !e.openElements.isRootHtmlElementCurrent() && (e.openElements.pop(), !e.fragmentContext && e.openElements.currentTagId !== s.FRAMESET && (e.insertionMode = n.AFTER_FRAMESET));
}
function ua(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.NOFRAMES:
      R(e, t);
      break;
  }
}
function Aa(e, t) {
  t.tagID === s.HTML && (e.insertionMode = n.AFTER_AFTER_FRAMESET);
}
function Na(e, t) {
  t.tagID === s.HTML ? f(e, t) : K(e, t);
}
function K(e, t) {
  e.insertionMode = n.IN_BODY, j(e, t);
}
function Ia(e, t) {
  switch (t.tagID) {
    case s.HTML:
      f(e, t);
      break;
    case s.NOFRAMES:
      R(e, t);
      break;
  }
}
function fa(e, t) {
  t.chars = u, e._insertCharacters(t);
}
function Ca(e, t) {
  e._insertCharacters(t), e.framesetOk = !1;
}
function Ve(e) {
  for (; e.treeAdapter.getNamespaceURI(e.openElements.current) !== h.HTML && e.openElements.currentTagId !== void 0 && !e._isIntegrationPoint(e.openElements.currentTagId, e.openElements.current); ) e.openElements.pop();
}
function Oa(e, t) {
  if (Ft(t))
    Ve(e), e._startTagOutsideForeignContent(t);
  else {
    const a = e._getAdjustedCurrentElement(), o = e.treeAdapter.getNamespaceURI(a);
    o === h.MATHML ? Me(t) : o === h.SVG && (yt(t), Be(t)), oe(t), t.selfClosing ? e._appendElement(t, o) : e._insertElement(t, o), t.ackSelfClosing = !0;
  }
}
function Sa(e, t) {
  if (t.tagID === s.P || t.tagID === s.BR) {
    Ve(e), e._endTagOutsideForeignContent(t);
    return;
  }
  for (let a = e.openElements.stackTop; a > 0; a--) {
    const o = e.openElements.items[a];
    if (e.treeAdapter.getNamespaceURI(o) === h.HTML) {
      e._endTagOutsideForeignContent(t);
      break;
    }
    const T = e.treeAdapter.getTagName(o);
    if (T.toLowerCase() === t.tagName) {
      t.tagName = T, e.openElements.shortenToLength(a);
      break;
    }
  }
}
function La(e, t) {
  return qt.parse(e, t);
}
export {
  La as parse
};
