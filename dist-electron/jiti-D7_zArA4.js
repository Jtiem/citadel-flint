import _r, { createRequire as js } from "node:module";
import { bF as Er } from "./main-CEfjB-ow.js";
import br from "node:os";
import Sr from "node:fs";
import Cr from "node:url";
import Ir from "node:assert";
import kr from "node:process";
import wr from "node:path";
import Rr from "node:v8";
import Ar from "node:util";
import Tr from "node:crypto";
import Pr from "node:tty";
import Nr from "node:perf_hooks";
import Lr from "node:vm";
var _e = { exports: {} }, Ms;
function Or() {
  return Ms || (Ms = 1, (() => {
    var z = { "./node_modules/.pnpm/mlly@1.8.0/node_modules/mlly/dist lazy recursive": function(A) {
      function R(M) {
        return Promise.resolve().then(function() {
          var Et = new Error("Cannot find module '" + M + "'");
          throw Et.code = "MODULE_NOT_FOUND", Et;
        });
      }
      R.keys = () => [], R.resolve = R, R.id = "./node_modules/.pnpm/mlly@1.8.0/node_modules/mlly/dist lazy recursive", A.exports = R;
    } }, it = {};
    function W(A) {
      var R = it[A];
      if (R !== void 0) return R.exports;
      var M = it[A] = { exports: {} };
      return z[A](M, M.exports, W), M.exports;
    }
    W.n = (A) => {
      var R = A && A.__esModule ? () => A.default : () => A;
      return W.d(R, { a: R }), R;
    }, W.d = (A, R) => {
      for (var M in R) W.o(R, M) && !W.o(A, M) && Object.defineProperty(A, M, { enumerable: !0, get: R[M] });
    }, W.o = (A, R) => Object.prototype.hasOwnProperty.call(A, R);
    var be = {};
    (() => {
      W.d(be, { default: () => Us });
      const A = br;
      var R = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 80, 3, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 343, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 726, 6, 110, 6, 6, 9, 4759, 9, 787719, 239], M = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 2, 60, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 42, 9, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 496, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3, 5761, 15, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 4191], Et = "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-ࢎࢠ-ࣉऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱৼਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡૹଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘ-ౚౝౠౡಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೝೞೠೡೱೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖൟ-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄຆ-ຊຌ-ຣລວ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡸᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭌᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎㆠ-ㆿㇰ-ㇿ㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꟍꟐꟑꟓꟕ-Ƛꟲ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꣽꣾꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ", Gt = { 3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile", 5: "class enum extends super const export import", 6: "enum", strict: "implements interface let package private protected public static yield", strictBind: "eval arguments" }, Ht = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this", Bs = { 5: Ht, "5module": Ht + " export import", 6: Ht + " const class extends export import super" }, Fs = /^in(stanceof)?$/, $s = new RegExp("[" + Et + "]"), qs = new RegExp("[" + Et + "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߽߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࢗ-࢟࣊-ࣣ࣡-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯৾ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ૺ-૿ଁ-ଃ଼ା-ୄେୈୋ-୍୕-ୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఄ఼ా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ೳഀ-ഃ഻഼ാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ඁ-ඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ຼ່-໎໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜕ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠏-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᪿ-ᫎᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭᳴᳷-᳹᷀-᷿‌‍‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯・꘠-꘩꙯ꙴ-꙽ꚞꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧ꠬ꢀꢁꢴ-ꣅ꣐-꣙꣠-꣱ꣿ-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︯︳︴﹍-﹏０-９＿･]");
      function Kt(t, e) {
        for (var s = 65536, i = 0; i < e.length; i += 2) {
          if ((s += e[i]) > t) return !1;
          if ((s += e[i + 1]) >= t) return !0;
        }
        return !1;
      }
      function G(t, e) {
        return t < 65 ? t === 36 : t < 91 || (t < 97 ? t === 95 : t < 123 || (t <= 65535 ? t >= 170 && $s.test(String.fromCharCode(t)) : e !== !1 && Kt(t, M)));
      }
      function Q(t, e) {
        return t < 48 ? t === 36 : t < 58 || !(t < 65) && (t < 91 || (t < 97 ? t === 95 : t < 123 || (t <= 65535 ? t >= 170 && qs.test(String.fromCharCode(t)) : e !== !1 && (Kt(t, M) || Kt(t, R)))));
      }
      var b = function(t, e) {
        e === void 0 && (e = {}), this.label = t, this.keyword = e.keyword, this.beforeExpr = !!e.beforeExpr, this.startsExpr = !!e.startsExpr, this.isLoop = !!e.isLoop, this.isAssign = !!e.isAssign, this.prefix = !!e.prefix, this.postfix = !!e.postfix, this.binop = e.binop || null, this.updateContext = null;
      };
      function j(t, e) {
        return new b(t, { beforeExpr: !0, binop: e });
      }
      var B = { beforeExpr: !0 }, V = { startsExpr: !0 }, zt = {};
      function E(t, e) {
        return e === void 0 && (e = {}), e.keyword = t, zt[t] = new b(t, e);
      }
      var n = { num: new b("num", V), regexp: new b("regexp", V), string: new b("string", V), name: new b("name", V), privateId: new b("privateId", V), eof: new b("eof"), bracketL: new b("[", { beforeExpr: !0, startsExpr: !0 }), bracketR: new b("]"), braceL: new b("{", { beforeExpr: !0, startsExpr: !0 }), braceR: new b("}"), parenL: new b("(", { beforeExpr: !0, startsExpr: !0 }), parenR: new b(")"), comma: new b(",", B), semi: new b(";", B), colon: new b(":", B), dot: new b("."), question: new b("?", B), questionDot: new b("?."), arrow: new b("=>", B), template: new b("template"), invalidTemplate: new b("invalidTemplate"), ellipsis: new b("...", B), backQuote: new b("`", V), dollarBraceL: new b("${", { beforeExpr: !0, startsExpr: !0 }), eq: new b("=", { beforeExpr: !0, isAssign: !0 }), assign: new b("_=", { beforeExpr: !0, isAssign: !0 }), incDec: new b("++/--", { prefix: !0, postfix: !0, startsExpr: !0 }), prefix: new b("!/~", { beforeExpr: !0, prefix: !0, startsExpr: !0 }), logicalOR: j("||", 1), logicalAND: j("&&", 2), bitwiseOR: j("|", 3), bitwiseXOR: j("^", 4), bitwiseAND: j("&", 5), equality: j("==/!=/===/!==", 6), relational: j("</>/<=/>=", 7), bitShift: j("<</>>/>>>", 8), plusMin: new b("+/-", { beforeExpr: !0, binop: 9, prefix: !0, startsExpr: !0 }), modulo: j("%", 10), star: j("*", 10), slash: j("/", 10), starstar: new b("**", { beforeExpr: !0 }), coalesce: j("??", 1), _break: E("break"), _case: E("case", B), _catch: E("catch"), _continue: E("continue"), _debugger: E("debugger"), _default: E("default", B), _do: E("do", { isLoop: !0, beforeExpr: !0 }), _else: E("else", B), _finally: E("finally"), _for: E("for", { isLoop: !0 }), _function: E("function", V), _if: E("if"), _return: E("return", B), _switch: E("switch"), _throw: E("throw", B), _try: E("try"), _var: E("var"), _const: E("const"), _while: E("while", { isLoop: !0 }), _with: E("with"), _new: E("new", { beforeExpr: !0, startsExpr: !0 }), _this: E("this", V), _super: E("super", V), _class: E("class", V), _extends: E("extends", B), _export: E("export"), _import: E("import", V), _null: E("null", V), _true: E("true", V), _false: E("false", V), _in: E("in", { beforeExpr: !0, binop: 7 }), _instanceof: E("instanceof", { beforeExpr: !0, binop: 7 }), _typeof: E("typeof", { beforeExpr: !0, prefix: !0, startsExpr: !0 }), _void: E("void", { beforeExpr: !0, prefix: !0, startsExpr: !0 }), _delete: E("delete", { beforeExpr: !0, prefix: !0, startsExpr: !0 }) }, U = /\r\n?|\n|\u2028|\u2029/, Ws = new RegExp(U.source, "g");
      function lt(t) {
        return t === 10 || t === 13 || t === 8232 || t === 8233;
      }
      function Se(t, e, s) {
        s === void 0 && (s = t.length);
        for (var i = e; i < s; i++) {
          var r = t.charCodeAt(i);
          if (lt(r)) return i < s - 1 && r === 13 && t.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
        }
        return -1;
      }
      var Ce = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/, N = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g, Ie = Object.prototype, Gs = Ie.hasOwnProperty, Hs = Ie.toString, pt = Object.hasOwn || function(t, e) {
        return Gs.call(t, e);
      }, ke = Array.isArray || function(t) {
        return Hs.call(t) === "[object Array]";
      }, we = /* @__PURE__ */ Object.create(null);
      function Z(t) {
        return we[t] || (we[t] = new RegExp("^(?:" + t.replace(/ /g, "|") + ")$"));
      }
      function J(t) {
        return t <= 65535 ? String.fromCharCode(t) : (t -= 65536, String.fromCharCode(55296 + (t >> 10), 56320 + (1023 & t)));
      }
      var Ks = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/, bt = function(t, e) {
        this.line = t, this.column = e;
      };
      bt.prototype.offset = function(t) {
        return new bt(this.line, this.column + t);
      };
      var Tt = function(t, e, s) {
        this.start = e, this.end = s, t.sourceFile !== null && (this.source = t.sourceFile);
      };
      function Re(t, e) {
        for (var s = 1, i = 0; ; ) {
          var r = Se(t, i, e);
          if (r < 0) return new bt(s, e - i);
          ++s, i = r;
        }
      }
      var Jt = { ecmaVersion: null, sourceType: "script", onInsertedSemicolon: null, onTrailingComma: null, allowReserved: null, allowReturnOutsideFunction: !1, allowImportExportEverywhere: !1, allowAwaitOutsideFunction: null, allowSuperOutsideMethod: null, allowHashBang: !1, checkPrivateFields: !0, locations: !1, onToken: null, onComment: null, ranges: !1, program: null, sourceFile: null, directSourceFile: null, preserveParens: !1 }, Ae = !1;
      function zs(t) {
        var e = {};
        for (var s in Jt) e[s] = t && pt(t, s) ? t[s] : Jt[s];
        if (e.ecmaVersion === "latest" ? e.ecmaVersion = 1e8 : e.ecmaVersion == null ? (!Ae && typeof console == "object" && console.warn && (Ae = !0, console.warn(`Since Acorn 8.0.0, options.ecmaVersion is required.
Defaulting to 2020, but this will stop working in the future.`)), e.ecmaVersion = 11) : e.ecmaVersion >= 2015 && (e.ecmaVersion -= 2009), e.allowReserved == null && (e.allowReserved = e.ecmaVersion < 5), t && t.allowHashBang != null || (e.allowHashBang = e.ecmaVersion >= 14), ke(e.onToken)) {
          var i = e.onToken;
          e.onToken = function(r) {
            return i.push(r);
          };
        }
        return ke(e.onComment) && (e.onComment = /* @__PURE__ */ (function(r, a) {
          return function(o, h, c, p, l, f) {
            var u = { type: o ? "Block" : "Line", value: h, start: c, end: p };
            r.locations && (u.loc = new Tt(this, l, f)), r.ranges && (u.range = [c, p]), a.push(u);
          };
        })(e, e.onComment)), e;
      }
      var Js = 256, Te = 259;
      function Yt(t, e) {
        return 2 | (t ? 4 : 0) | (e ? 8 : 0);
      }
      var P = function(t, e, s) {
        this.options = t = zs(t), this.sourceFile = t.sourceFile, this.keywords = Z(Bs[t.ecmaVersion >= 6 ? 6 : t.sourceType === "module" ? "5module" : 5]);
        var i = "";
        t.allowReserved !== !0 && (i = Gt[t.ecmaVersion >= 6 ? 6 : t.ecmaVersion === 5 ? 5 : 3], t.sourceType === "module" && (i += " await")), this.reservedWords = Z(i);
        var r = (i ? i + " " : "") + Gt.strict;
        this.reservedWordsStrict = Z(r), this.reservedWordsStrictBind = Z(r + " " + Gt.strictBind), this.input = String(e), this.containsEsc = !1, s ? (this.pos = s, this.lineStart = this.input.lastIndexOf(`
`, s - 1) + 1, this.curLine = this.input.slice(0, this.lineStart).split(U).length) : (this.pos = this.lineStart = 0, this.curLine = 1), this.type = n.eof, this.value = null, this.start = this.end = this.pos, this.startLoc = this.endLoc = this.curPosition(), this.lastTokEndLoc = this.lastTokStartLoc = null, this.lastTokStart = this.lastTokEnd = this.pos, this.context = this.initialContext(), this.exprAllowed = !0, this.inModule = t.sourceType === "module", this.strict = this.inModule || this.strictDirective(this.pos), this.potentialArrowAt = -1, this.potentialArrowInForAwait = !1, this.yieldPos = this.awaitPos = this.awaitIdentPos = 0, this.labels = [], this.undefinedExports = /* @__PURE__ */ Object.create(null), this.pos === 0 && t.allowHashBang && this.input.slice(0, 2) === "#!" && this.skipLineComment(2), this.scopeStack = [], this.enterScope(1), this.regexpState = null, this.privateNameStack = [];
      }, H = { inFunction: { configurable: !0 }, inGenerator: { configurable: !0 }, inAsync: { configurable: !0 }, canAwait: { configurable: !0 }, allowSuper: { configurable: !0 }, allowDirectSuper: { configurable: !0 }, treatFunctionsAsVar: { configurable: !0 }, allowNewDotTarget: { configurable: !0 }, inClassStaticBlock: { configurable: !0 } };
      P.prototype.parse = function() {
        var t = this.options.program || this.startNode();
        return this.nextToken(), this.parseTopLevel(t);
      }, H.inFunction.get = function() {
        return (2 & this.currentVarScope().flags) > 0;
      }, H.inGenerator.get = function() {
        return (8 & this.currentVarScope().flags) > 0;
      }, H.inAsync.get = function() {
        return (4 & this.currentVarScope().flags) > 0;
      }, H.canAwait.get = function() {
        for (var t = this.scopeStack.length - 1; t >= 0; t--) {
          var e = this.scopeStack[t].flags;
          if (768 & e) return !1;
          if (2 & e) return (4 & e) > 0;
        }
        return this.inModule && this.options.ecmaVersion >= 13 || this.options.allowAwaitOutsideFunction;
      }, H.allowSuper.get = function() {
        return (64 & this.currentThisScope().flags) > 0 || this.options.allowSuperOutsideMethod;
      }, H.allowDirectSuper.get = function() {
        return (128 & this.currentThisScope().flags) > 0;
      }, H.treatFunctionsAsVar.get = function() {
        return this.treatFunctionsAsVarInScope(this.currentScope());
      }, H.allowNewDotTarget.get = function() {
        for (var t = this.scopeStack.length - 1; t >= 0; t--) {
          var e = this.scopeStack[t].flags;
          if (768 & e || 2 & e && !(16 & e)) return !0;
        }
        return !1;
      }, H.inClassStaticBlock.get = function() {
        return (this.currentVarScope().flags & Js) > 0;
      }, P.extend = function() {
        for (var t = [], e = arguments.length; e--; ) t[e] = arguments[e];
        for (var s = this, i = 0; i < t.length; i++) s = t[i](s);
        return s;
      }, P.parse = function(t, e) {
        return new this(e, t).parse();
      }, P.parseExpressionAt = function(t, e, s) {
        var i = new this(s, t, e);
        return i.nextToken(), i.parseExpression();
      }, P.tokenizer = function(t, e) {
        return new this(e, t);
      }, Object.defineProperties(P.prototype, H);
      var L = P.prototype, Ys = /^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/;
      L.strictDirective = function(t) {
        if (this.options.ecmaVersion < 5) return !1;
        for (; ; ) {
          N.lastIndex = t, t += N.exec(this.input)[0].length;
          var e = Ys.exec(this.input.slice(t));
          if (!e) return !1;
          if ((e[1] || e[2]) === "use strict") {
            N.lastIndex = t + e[0].length;
            var s = N.exec(this.input), i = s.index + s[0].length, r = this.input.charAt(i);
            return r === ";" || r === "}" || U.test(s[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(r) || r === "!" && this.input.charAt(i + 1) === "=");
          }
          t += e[0].length, N.lastIndex = t, t += N.exec(this.input)[0].length, this.input[t] === ";" && t++;
        }
      }, L.eat = function(t) {
        return this.type === t && (this.next(), !0);
      }, L.isContextual = function(t) {
        return this.type === n.name && this.value === t && !this.containsEsc;
      }, L.eatContextual = function(t) {
        return !!this.isContextual(t) && (this.next(), !0);
      }, L.expectContextual = function(t) {
        this.eatContextual(t) || this.unexpected();
      }, L.canInsertSemicolon = function() {
        return this.type === n.eof || this.type === n.braceR || U.test(this.input.slice(this.lastTokEnd, this.start));
      }, L.insertSemicolon = function() {
        if (this.canInsertSemicolon()) return this.options.onInsertedSemicolon && this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc), !0;
      }, L.semicolon = function() {
        this.eat(n.semi) || this.insertSemicolon() || this.unexpected();
      }, L.afterTrailingComma = function(t, e) {
        if (this.type === t) return this.options.onTrailingComma && this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc), e || this.next(), !0;
      }, L.expect = function(t) {
        this.eat(t) || this.unexpected();
      }, L.unexpected = function(t) {
        this.raise(t ?? this.start, "Unexpected token");
      };
      var Pt = function() {
        this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
      };
      L.checkPatternErrors = function(t, e) {
        if (t) {
          t.trailingComma > -1 && this.raiseRecoverable(t.trailingComma, "Comma is not permitted after the rest element");
          var s = e ? t.parenthesizedAssign : t.parenthesizedBind;
          s > -1 && this.raiseRecoverable(s, e ? "Assigning to rvalue" : "Parenthesized pattern");
        }
      }, L.checkExpressionErrors = function(t, e) {
        if (!t) return !1;
        var s = t.shorthandAssign, i = t.doubleProto;
        if (!e) return s >= 0 || i >= 0;
        s >= 0 && this.raise(s, "Shorthand property assignments are valid only in destructuring patterns"), i >= 0 && this.raiseRecoverable(i, "Redefinition of __proto__ property");
      }, L.checkYieldAwaitInDefaultParams = function() {
        this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos) && this.raise(this.yieldPos, "Yield expression cannot be a default value"), this.awaitPos && this.raise(this.awaitPos, "Await expression cannot be a default value");
      }, L.isSimpleAssignTarget = function(t) {
        return t.type === "ParenthesizedExpression" ? this.isSimpleAssignTarget(t.expression) : t.type === "Identifier" || t.type === "MemberExpression";
      };
      var m = P.prototype;
      m.parseTopLevel = function(t) {
        var e = /* @__PURE__ */ Object.create(null);
        for (t.body || (t.body = []); this.type !== n.eof; ) {
          var s = this.parseStatement(null, !0, e);
          t.body.push(s);
        }
        if (this.inModule) for (var i = 0, r = Object.keys(this.undefinedExports); i < r.length; i += 1) {
          var a = r[i];
          this.raiseRecoverable(this.undefinedExports[a].start, "Export '" + a + "' is not defined");
        }
        return this.adaptDirectivePrologue(t.body), this.next(), t.sourceType = this.options.sourceType, this.finishNode(t, "Program");
      };
      var Qt = { kind: "loop" }, Qs = { kind: "switch" };
      m.isLet = function(t) {
        if (this.options.ecmaVersion < 6 || !this.isContextual("let")) return !1;
        N.lastIndex = this.pos;
        var e = N.exec(this.input), s = this.pos + e[0].length, i = this.input.charCodeAt(s);
        if (i === 91 || i === 92) return !0;
        if (t) return !1;
        if (i === 123 || i > 55295 && i < 56320) return !0;
        if (G(i, !0)) {
          for (var r = s + 1; Q(i = this.input.charCodeAt(r), !0); ) ++r;
          if (i === 92 || i > 55295 && i < 56320) return !0;
          var a = this.input.slice(s, r);
          if (!Fs.test(a)) return !0;
        }
        return !1;
      }, m.isAsyncFunction = function() {
        if (this.options.ecmaVersion < 8 || !this.isContextual("async")) return !1;
        N.lastIndex = this.pos;
        var t, e = N.exec(this.input), s = this.pos + e[0].length;
        return !(U.test(this.input.slice(this.pos, s)) || this.input.slice(s, s + 8) !== "function" || s + 8 !== this.input.length && (Q(t = this.input.charCodeAt(s + 8)) || t > 55295 && t < 56320));
      }, m.isUsingKeyword = function(t, e) {
        if (this.options.ecmaVersion < 17 || !this.isContextual(t ? "await" : "using")) return !1;
        N.lastIndex = this.pos;
        var s = N.exec(this.input), i = this.pos + s[0].length;
        if (U.test(this.input.slice(this.pos, i))) return !1;
        if (t) {
          var r, a = i + 5;
          if (this.input.slice(i, a) !== "using" || a === this.input.length || Q(r = this.input.charCodeAt(a)) || r > 55295 && r < 56320) return !1;
          N.lastIndex = a;
          var o = N.exec(this.input);
          if (o && U.test(this.input.slice(a, a + o[0].length))) return !1;
        }
        if (e) {
          var h, c = i + 2;
          if (!(this.input.slice(i, c) !== "of" || c !== this.input.length && (Q(h = this.input.charCodeAt(c)) || h > 55295 && h < 56320))) return !1;
        }
        var p = this.input.charCodeAt(i);
        return G(p, !0) || p === 92;
      }, m.isAwaitUsing = function(t) {
        return this.isUsingKeyword(!0, t);
      }, m.isUsing = function(t) {
        return this.isUsingKeyword(!1, t);
      }, m.parseStatement = function(t, e, s) {
        var i, r = this.type, a = this.startNode();
        switch (this.isLet(t) && (r = n._var, i = "let"), r) {
          case n._break:
          case n._continue:
            return this.parseBreakContinueStatement(a, r.keyword);
          case n._debugger:
            return this.parseDebuggerStatement(a);
          case n._do:
            return this.parseDoStatement(a);
          case n._for:
            return this.parseForStatement(a);
          case n._function:
            return t && (this.strict || t !== "if" && t !== "label") && this.options.ecmaVersion >= 6 && this.unexpected(), this.parseFunctionStatement(a, !1, !t);
          case n._class:
            return t && this.unexpected(), this.parseClass(a, !0);
          case n._if:
            return this.parseIfStatement(a);
          case n._return:
            return this.parseReturnStatement(a);
          case n._switch:
            return this.parseSwitchStatement(a);
          case n._throw:
            return this.parseThrowStatement(a);
          case n._try:
            return this.parseTryStatement(a);
          case n._const:
          case n._var:
            return i = i || this.value, t && i !== "var" && this.unexpected(), this.parseVarStatement(a, i);
          case n._while:
            return this.parseWhileStatement(a);
          case n._with:
            return this.parseWithStatement(a);
          case n.braceL:
            return this.parseBlock(!0, a);
          case n.semi:
            return this.parseEmptyStatement(a);
          case n._export:
          case n._import:
            if (this.options.ecmaVersion > 10 && r === n._import) {
              N.lastIndex = this.pos;
              var o = N.exec(this.input), h = this.pos + o[0].length, c = this.input.charCodeAt(h);
              if (c === 40 || c === 46) return this.parseExpressionStatement(a, this.parseExpression());
            }
            return this.options.allowImportExportEverywhere || (e || this.raise(this.start, "'import' and 'export' may only appear at the top level"), this.inModule || this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'")), r === n._import ? this.parseImport(a) : this.parseExport(a, s);
          default:
            if (this.isAsyncFunction()) return t && this.unexpected(), this.next(), this.parseFunctionStatement(a, !0, !t);
            var p = this.isAwaitUsing(!1) ? "await using" : this.isUsing(!1) ? "using" : null;
            if (p) return e && this.options.sourceType === "script" && this.raise(this.start, "Using declaration cannot appear in the top level when source type is `script`"), p === "await using" && (this.canAwait || this.raise(this.start, "Await using cannot appear outside of async function"), this.next()), this.next(), this.parseVar(a, !1, p), this.semicolon(), this.finishNode(a, "VariableDeclaration");
            var l = this.value, f = this.parseExpression();
            return r === n.name && f.type === "Identifier" && this.eat(n.colon) ? this.parseLabeledStatement(a, l, f, t) : this.parseExpressionStatement(a, f);
        }
      }, m.parseBreakContinueStatement = function(t, e) {
        var s = e === "break";
        this.next(), this.eat(n.semi) || this.insertSemicolon() ? t.label = null : this.type !== n.name ? this.unexpected() : (t.label = this.parseIdent(), this.semicolon());
        for (var i = 0; i < this.labels.length; ++i) {
          var r = this.labels[i];
          if ((t.label == null || r.name === t.label.name) && (r.kind != null && (s || r.kind === "loop") || t.label && s))
            break;
        }
        return i === this.labels.length && this.raise(t.start, "Unsyntactic " + e), this.finishNode(t, s ? "BreakStatement" : "ContinueStatement");
      }, m.parseDebuggerStatement = function(t) {
        return this.next(), this.semicolon(), this.finishNode(t, "DebuggerStatement");
      }, m.parseDoStatement = function(t) {
        return this.next(), this.labels.push(Qt), t.body = this.parseStatement("do"), this.labels.pop(), this.expect(n._while), t.test = this.parseParenExpression(), this.options.ecmaVersion >= 6 ? this.eat(n.semi) : this.semicolon(), this.finishNode(t, "DoWhileStatement");
      }, m.parseForStatement = function(t) {
        this.next();
        var e = this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await") ? this.lastTokStart : -1;
        if (this.labels.push(Qt), this.enterScope(0), this.expect(n.parenL), this.type === n.semi) return e > -1 && this.unexpected(e), this.parseFor(t, null);
        var s = this.isLet();
        if (this.type === n._var || this.type === n._const || s) {
          var i = this.startNode(), r = s ? "let" : this.value;
          return this.next(), this.parseVar(i, !0, r), this.finishNode(i, "VariableDeclaration"), this.parseForAfterInit(t, i, e);
        }
        var a = this.isContextual("let"), o = !1, h = this.isUsing(!0) ? "using" : this.isAwaitUsing(!0) ? "await using" : null;
        if (h) {
          var c = this.startNode();
          return this.next(), h === "await using" && this.next(), this.parseVar(c, !0, h), this.finishNode(c, "VariableDeclaration"), this.parseForAfterInit(t, c, e);
        }
        var p = this.containsEsc, l = new Pt(), f = this.start, u = e > -1 ? this.parseExprSubscripts(l, "await") : this.parseExpression(!0, l);
        return this.type === n._in || (o = this.options.ecmaVersion >= 6 && this.isContextual("of")) ? (e > -1 ? (this.type === n._in && this.unexpected(e), t.await = !0) : o && this.options.ecmaVersion >= 8 && (u.start !== f || p || u.type !== "Identifier" || u.name !== "async" ? this.options.ecmaVersion >= 9 && (t.await = !1) : this.unexpected()), a && o && this.raise(u.start, "The left-hand side of a for-of loop may not start with 'let'."), this.toAssignable(u, !1, l), this.checkLValPattern(u), this.parseForIn(t, u)) : (this.checkExpressionErrors(l, !0), e > -1 && this.unexpected(e), this.parseFor(t, u));
      }, m.parseForAfterInit = function(t, e, s) {
        return (this.type === n._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && e.declarations.length === 1 ? (this.options.ecmaVersion >= 9 && (this.type === n._in ? s > -1 && this.unexpected(s) : t.await = s > -1), this.parseForIn(t, e)) : (s > -1 && this.unexpected(s), this.parseFor(t, e));
      }, m.parseFunctionStatement = function(t, e, s) {
        return this.next(), this.parseFunction(t, St | (s ? 0 : Zt), !1, e);
      }, m.parseIfStatement = function(t) {
        return this.next(), t.test = this.parseParenExpression(), t.consequent = this.parseStatement("if"), t.alternate = this.eat(n._else) ? this.parseStatement("if") : null, this.finishNode(t, "IfStatement");
      }, m.parseReturnStatement = function(t) {
        return this.inFunction || this.options.allowReturnOutsideFunction || this.raise(this.start, "'return' outside of function"), this.next(), this.eat(n.semi) || this.insertSemicolon() ? t.argument = null : (t.argument = this.parseExpression(), this.semicolon()), this.finishNode(t, "ReturnStatement");
      }, m.parseSwitchStatement = function(t) {
        var e;
        this.next(), t.discriminant = this.parseParenExpression(), t.cases = [], this.expect(n.braceL), this.labels.push(Qs), this.enterScope(0);
        for (var s = !1; this.type !== n.braceR; ) if (this.type === n._case || this.type === n._default) {
          var i = this.type === n._case;
          e && this.finishNode(e, "SwitchCase"), t.cases.push(e = this.startNode()), e.consequent = [], this.next(), i ? e.test = this.parseExpression() : (s && this.raiseRecoverable(this.lastTokStart, "Multiple default clauses"), s = !0, e.test = null), this.expect(n.colon);
        } else e || this.unexpected(), e.consequent.push(this.parseStatement(null));
        return this.exitScope(), e && this.finishNode(e, "SwitchCase"), this.next(), this.labels.pop(), this.finishNode(t, "SwitchStatement");
      }, m.parseThrowStatement = function(t) {
        return this.next(), U.test(this.input.slice(this.lastTokEnd, this.start)) && this.raise(this.lastTokEnd, "Illegal newline after throw"), t.argument = this.parseExpression(), this.semicolon(), this.finishNode(t, "ThrowStatement");
      };
      var Zs = [];
      m.parseCatchClauseParam = function() {
        var t = this.parseBindingAtom(), e = t.type === "Identifier";
        return this.enterScope(e ? 32 : 0), this.checkLValPattern(t, e ? 4 : 2), this.expect(n.parenR), t;
      }, m.parseTryStatement = function(t) {
        if (this.next(), t.block = this.parseBlock(), t.handler = null, this.type === n._catch) {
          var e = this.startNode();
          this.next(), this.eat(n.parenL) ? e.param = this.parseCatchClauseParam() : (this.options.ecmaVersion < 10 && this.unexpected(), e.param = null, this.enterScope(0)), e.body = this.parseBlock(!1), this.exitScope(), t.handler = this.finishNode(e, "CatchClause");
        }
        return t.finalizer = this.eat(n._finally) ? this.parseBlock() : null, t.handler || t.finalizer || this.raise(t.start, "Missing catch or finally clause"), this.finishNode(t, "TryStatement");
      }, m.parseVarStatement = function(t, e, s) {
        return this.next(), this.parseVar(t, !1, e, s), this.semicolon(), this.finishNode(t, "VariableDeclaration");
      }, m.parseWhileStatement = function(t) {
        return this.next(), t.test = this.parseParenExpression(), this.labels.push(Qt), t.body = this.parseStatement("while"), this.labels.pop(), this.finishNode(t, "WhileStatement");
      }, m.parseWithStatement = function(t) {
        return this.strict && this.raise(this.start, "'with' in strict mode"), this.next(), t.object = this.parseParenExpression(), t.body = this.parseStatement("with"), this.finishNode(t, "WithStatement");
      }, m.parseEmptyStatement = function(t) {
        return this.next(), this.finishNode(t, "EmptyStatement");
      }, m.parseLabeledStatement = function(t, e, s, i) {
        for (var r = 0, a = this.labels; r < a.length; r += 1)
          a[r].name === e && this.raise(s.start, "Label '" + e + "' is already declared");
        for (var o = this.type.isLoop ? "loop" : this.type === n._switch ? "switch" : null, h = this.labels.length - 1; h >= 0; h--) {
          var c = this.labels[h];
          if (c.statementStart !== t.start) break;
          c.statementStart = this.start, c.kind = o;
        }
        return this.labels.push({ name: e, kind: o, statementStart: this.start }), t.body = this.parseStatement(i ? i.indexOf("label") === -1 ? i + "label" : i : "label"), this.labels.pop(), t.label = s, this.finishNode(t, "LabeledStatement");
      }, m.parseExpressionStatement = function(t, e) {
        return t.expression = e, this.semicolon(), this.finishNode(t, "ExpressionStatement");
      }, m.parseBlock = function(t, e, s) {
        for (t === void 0 && (t = !0), e === void 0 && (e = this.startNode()), e.body = [], this.expect(n.braceL), t && this.enterScope(0); this.type !== n.braceR; ) {
          var i = this.parseStatement(null);
          e.body.push(i);
        }
        return s && (this.strict = !1), this.next(), t && this.exitScope(), this.finishNode(e, "BlockStatement");
      }, m.parseFor = function(t, e) {
        return t.init = e, this.expect(n.semi), t.test = this.type === n.semi ? null : this.parseExpression(), this.expect(n.semi), t.update = this.type === n.parenR ? null : this.parseExpression(), this.expect(n.parenR), t.body = this.parseStatement("for"), this.exitScope(), this.labels.pop(), this.finishNode(t, "ForStatement");
      }, m.parseForIn = function(t, e) {
        var s = this.type === n._in;
        return this.next(), e.type === "VariableDeclaration" && e.declarations[0].init != null && (!s || this.options.ecmaVersion < 8 || this.strict || e.kind !== "var" || e.declarations[0].id.type !== "Identifier") && this.raise(e.start, (s ? "for-in" : "for-of") + " loop variable declaration may not have an initializer"), t.left = e, t.right = s ? this.parseExpression() : this.parseMaybeAssign(), this.expect(n.parenR), t.body = this.parseStatement("for"), this.exitScope(), this.labels.pop(), this.finishNode(t, s ? "ForInStatement" : "ForOfStatement");
      }, m.parseVar = function(t, e, s, i) {
        for (t.declarations = [], t.kind = s; ; ) {
          var r = this.startNode();
          if (this.parseVarId(r, s), this.eat(n.eq) ? r.init = this.parseMaybeAssign(e) : i || s !== "const" || this.type === n._in || this.options.ecmaVersion >= 6 && this.isContextual("of") ? i || s !== "using" && s !== "await using" || !(this.options.ecmaVersion >= 17) || this.type === n._in || this.isContextual("of") ? i || r.id.type === "Identifier" || e && (this.type === n._in || this.isContextual("of")) ? r.init = null : this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value") : this.raise(this.lastTokEnd, "Missing initializer in " + s + " declaration") : this.unexpected(), t.declarations.push(this.finishNode(r, "VariableDeclarator")), !this.eat(n.comma)) break;
        }
        return t;
      }, m.parseVarId = function(t, e) {
        t.id = e === "using" || e === "await using" ? this.parseIdent() : this.parseBindingAtom(), this.checkLValPattern(t.id, e === "var" ? 1 : 2, !1);
      };
      var St = 1, Zt = 2;
      function Xs(t, e) {
        var s = e.key.name, i = t[s], r = "true";
        return e.type !== "MethodDefinition" || e.kind !== "get" && e.kind !== "set" || (r = (e.static ? "s" : "i") + e.kind), i === "iget" && r === "iset" || i === "iset" && r === "iget" || i === "sget" && r === "sset" || i === "sset" && r === "sget" ? (t[s] = "true", !1) : !!i || (t[s] = r, !1);
      }
      function Nt(t, e) {
        var s = t.computed, i = t.key;
        return !s && (i.type === "Identifier" && i.name === e || i.type === "Literal" && i.value === e);
      }
      m.parseFunction = function(t, e, s, i, r) {
        this.initFunction(t), (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !i) && (this.type === n.star && e & Zt && this.unexpected(), t.generator = this.eat(n.star)), this.options.ecmaVersion >= 8 && (t.async = !!i), e & St && (t.id = 4 & e && this.type !== n.name ? null : this.parseIdent(), !t.id || e & Zt || this.checkLValSimple(t.id, this.strict || t.generator || t.async ? this.treatFunctionsAsVar ? 1 : 2 : 3));
        var a = this.yieldPos, o = this.awaitPos, h = this.awaitIdentPos;
        return this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0, this.enterScope(Yt(t.async, t.generator)), e & St || (t.id = this.type === n.name ? this.parseIdent() : null), this.parseFunctionParams(t), this.parseFunctionBody(t, s, !1, r), this.yieldPos = a, this.awaitPos = o, this.awaitIdentPos = h, this.finishNode(t, e & St ? "FunctionDeclaration" : "FunctionExpression");
      }, m.parseFunctionParams = function(t) {
        this.expect(n.parenL), t.params = this.parseBindingList(n.parenR, !1, this.options.ecmaVersion >= 8), this.checkYieldAwaitInDefaultParams();
      }, m.parseClass = function(t, e) {
        this.next();
        var s = this.strict;
        this.strict = !0, this.parseClassId(t, e), this.parseClassSuper(t);
        var i = this.enterClassBody(), r = this.startNode(), a = !1;
        for (r.body = [], this.expect(n.braceL); this.type !== n.braceR; ) {
          var o = this.parseClassElement(t.superClass !== null);
          o && (r.body.push(o), o.type === "MethodDefinition" && o.kind === "constructor" ? (a && this.raiseRecoverable(o.start, "Duplicate constructor in the same class"), a = !0) : o.key && o.key.type === "PrivateIdentifier" && Xs(i, o) && this.raiseRecoverable(o.key.start, "Identifier '#" + o.key.name + "' has already been declared"));
        }
        return this.strict = s, this.next(), t.body = this.finishNode(r, "ClassBody"), this.exitClassBody(), this.finishNode(t, e ? "ClassDeclaration" : "ClassExpression");
      }, m.parseClassElement = function(t) {
        if (this.eat(n.semi)) return null;
        var e = this.options.ecmaVersion, s = this.startNode(), i = "", r = !1, a = !1, o = "method", h = !1;
        if (this.eatContextual("static")) {
          if (e >= 13 && this.eat(n.braceL)) return this.parseClassStaticBlock(s), s;
          this.isClassElementNameStart() || this.type === n.star ? h = !0 : i = "static";
        }
        if (s.static = h, !i && e >= 8 && this.eatContextual("async") && (!this.isClassElementNameStart() && this.type !== n.star || this.canInsertSemicolon() ? i = "async" : a = !0), !i && (e >= 9 || !a) && this.eat(n.star) && (r = !0), !i && !a && !r) {
          var c = this.value;
          (this.eatContextual("get") || this.eatContextual("set")) && (this.isClassElementNameStart() ? o = c : i = c);
        }
        if (i ? (s.computed = !1, s.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc), s.key.name = i, this.finishNode(s.key, "Identifier")) : this.parseClassElementName(s), e < 13 || this.type === n.parenL || o !== "method" || r || a) {
          var p = !s.static && Nt(s, "constructor"), l = p && t;
          p && o !== "method" && this.raise(s.key.start, "Constructor can't have get/set modifier"), s.kind = p ? "constructor" : o, this.parseClassMethod(s, r, a, l);
        } else this.parseClassField(s);
        return s;
      }, m.isClassElementNameStart = function() {
        return this.type === n.name || this.type === n.privateId || this.type === n.num || this.type === n.string || this.type === n.bracketL || this.type.keyword;
      }, m.parseClassElementName = function(t) {
        this.type === n.privateId ? (this.value === "constructor" && this.raise(this.start, "Classes can't have an element named '#constructor'"), t.computed = !1, t.key = this.parsePrivateIdent()) : this.parsePropertyName(t);
      }, m.parseClassMethod = function(t, e, s, i) {
        var r = t.key;
        t.kind === "constructor" ? (e && this.raise(r.start, "Constructor can't be a generator"), s && this.raise(r.start, "Constructor can't be an async method")) : t.static && Nt(t, "prototype") && this.raise(r.start, "Classes may not have a static property named prototype");
        var a = t.value = this.parseMethod(e, s, i);
        return t.kind === "get" && a.params.length !== 0 && this.raiseRecoverable(a.start, "getter should have no params"), t.kind === "set" && a.params.length !== 1 && this.raiseRecoverable(a.start, "setter should have exactly one param"), t.kind === "set" && a.params[0].type === "RestElement" && this.raiseRecoverable(a.params[0].start, "Setter cannot use rest params"), this.finishNode(t, "MethodDefinition");
      }, m.parseClassField = function(t) {
        return Nt(t, "constructor") ? this.raise(t.key.start, "Classes can't have a field named 'constructor'") : t.static && Nt(t, "prototype") && this.raise(t.key.start, "Classes can't have a static field named 'prototype'"), this.eat(n.eq) ? (this.enterScope(576), t.value = this.parseMaybeAssign(), this.exitScope()) : t.value = null, this.semicolon(), this.finishNode(t, "PropertyDefinition");
      }, m.parseClassStaticBlock = function(t) {
        t.body = [];
        var e = this.labels;
        for (this.labels = [], this.enterScope(320); this.type !== n.braceR; ) {
          var s = this.parseStatement(null);
          t.body.push(s);
        }
        return this.next(), this.exitScope(), this.labels = e, this.finishNode(t, "StaticBlock");
      }, m.parseClassId = function(t, e) {
        this.type === n.name ? (t.id = this.parseIdent(), e && this.checkLValSimple(t.id, 2, !1)) : (e === !0 && this.unexpected(), t.id = null);
      }, m.parseClassSuper = function(t) {
        t.superClass = this.eat(n._extends) ? this.parseExprSubscripts(null, !1) : null;
      }, m.enterClassBody = function() {
        var t = { declared: /* @__PURE__ */ Object.create(null), used: [] };
        return this.privateNameStack.push(t), t.declared;
      }, m.exitClassBody = function() {
        var t = this.privateNameStack.pop(), e = t.declared, s = t.used;
        if (this.options.checkPrivateFields) for (var i = this.privateNameStack.length, r = i === 0 ? null : this.privateNameStack[i - 1], a = 0; a < s.length; ++a) {
          var o = s[a];
          pt(e, o.name) || (r ? r.used.push(o) : this.raiseRecoverable(o.start, "Private field '#" + o.name + "' must be declared in an enclosing class"));
        }
      }, m.parseExportAllDeclaration = function(t, e) {
        return this.options.ecmaVersion >= 11 && (this.eatContextual("as") ? (t.exported = this.parseModuleExportName(), this.checkExport(e, t.exported, this.lastTokStart)) : t.exported = null), this.expectContextual("from"), this.type !== n.string && this.unexpected(), t.source = this.parseExprAtom(), this.options.ecmaVersion >= 16 && (t.attributes = this.parseWithClause()), this.semicolon(), this.finishNode(t, "ExportAllDeclaration");
      }, m.parseExport = function(t, e) {
        if (this.next(), this.eat(n.star)) return this.parseExportAllDeclaration(t, e);
        if (this.eat(n._default)) return this.checkExport(e, "default", this.lastTokStart), t.declaration = this.parseExportDefaultDeclaration(), this.finishNode(t, "ExportDefaultDeclaration");
        if (this.shouldParseExportStatement()) t.declaration = this.parseExportDeclaration(t), t.declaration.type === "VariableDeclaration" ? this.checkVariableExport(e, t.declaration.declarations) : this.checkExport(e, t.declaration.id, t.declaration.id.start), t.specifiers = [], t.source = null, this.options.ecmaVersion >= 16 && (t.attributes = []);
        else {
          if (t.declaration = null, t.specifiers = this.parseExportSpecifiers(e), this.eatContextual("from")) this.type !== n.string && this.unexpected(), t.source = this.parseExprAtom(), this.options.ecmaVersion >= 16 && (t.attributes = this.parseWithClause());
          else {
            for (var s = 0, i = t.specifiers; s < i.length; s += 1) {
              var r = i[s];
              this.checkUnreserved(r.local), this.checkLocalExport(r.local), r.local.type === "Literal" && this.raise(r.local.start, "A string literal cannot be used as an exported binding without `from`.");
            }
            t.source = null, this.options.ecmaVersion >= 16 && (t.attributes = []);
          }
          this.semicolon();
        }
        return this.finishNode(t, "ExportNamedDeclaration");
      }, m.parseExportDeclaration = function(t) {
        return this.parseStatement(null);
      }, m.parseExportDefaultDeclaration = function() {
        var t;
        if (this.type === n._function || (t = this.isAsyncFunction())) {
          var e = this.startNode();
          return this.next(), t && this.next(), this.parseFunction(e, 4 | St, !1, t);
        }
        if (this.type === n._class) {
          var s = this.startNode();
          return this.parseClass(s, "nullableID");
        }
        var i = this.parseMaybeAssign();
        return this.semicolon(), i;
      }, m.checkExport = function(t, e, s) {
        t && (typeof e != "string" && (e = e.type === "Identifier" ? e.name : e.value), pt(t, e) && this.raiseRecoverable(s, "Duplicate export '" + e + "'"), t[e] = !0);
      }, m.checkPatternExport = function(t, e) {
        var s = e.type;
        if (s === "Identifier") this.checkExport(t, e, e.start);
        else if (s === "ObjectPattern") for (var i = 0, r = e.properties; i < r.length; i += 1) {
          var a = r[i];
          this.checkPatternExport(t, a);
        }
        else if (s === "ArrayPattern") for (var o = 0, h = e.elements; o < h.length; o += 1) {
          var c = h[o];
          c && this.checkPatternExport(t, c);
        }
        else s === "Property" ? this.checkPatternExport(t, e.value) : s === "AssignmentPattern" ? this.checkPatternExport(t, e.left) : s === "RestElement" && this.checkPatternExport(t, e.argument);
      }, m.checkVariableExport = function(t, e) {
        if (t) for (var s = 0, i = e; s < i.length; s += 1) {
          var r = i[s];
          this.checkPatternExport(t, r.id);
        }
      }, m.shouldParseExportStatement = function() {
        return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
      }, m.parseExportSpecifier = function(t) {
        var e = this.startNode();
        return e.local = this.parseModuleExportName(), e.exported = this.eatContextual("as") ? this.parseModuleExportName() : e.local, this.checkExport(t, e.exported, e.exported.start), this.finishNode(e, "ExportSpecifier");
      }, m.parseExportSpecifiers = function(t) {
        var e = [], s = !0;
        for (this.expect(n.braceL); !this.eat(n.braceR); ) {
          if (s) s = !1;
          else if (this.expect(n.comma), this.afterTrailingComma(n.braceR)) break;
          e.push(this.parseExportSpecifier(t));
        }
        return e;
      }, m.parseImport = function(t) {
        return this.next(), this.type === n.string ? (t.specifiers = Zs, t.source = this.parseExprAtom()) : (t.specifiers = this.parseImportSpecifiers(), this.expectContextual("from"), t.source = this.type === n.string ? this.parseExprAtom() : this.unexpected()), this.options.ecmaVersion >= 16 && (t.attributes = this.parseWithClause()), this.semicolon(), this.finishNode(t, "ImportDeclaration");
      }, m.parseImportSpecifier = function() {
        var t = this.startNode();
        return t.imported = this.parseModuleExportName(), this.eatContextual("as") ? t.local = this.parseIdent() : (this.checkUnreserved(t.imported), t.local = t.imported), this.checkLValSimple(t.local, 2), this.finishNode(t, "ImportSpecifier");
      }, m.parseImportDefaultSpecifier = function() {
        var t = this.startNode();
        return t.local = this.parseIdent(), this.checkLValSimple(t.local, 2), this.finishNode(t, "ImportDefaultSpecifier");
      }, m.parseImportNamespaceSpecifier = function() {
        var t = this.startNode();
        return this.next(), this.expectContextual("as"), t.local = this.parseIdent(), this.checkLValSimple(t.local, 2), this.finishNode(t, "ImportNamespaceSpecifier");
      }, m.parseImportSpecifiers = function() {
        var t = [], e = !0;
        if (this.type === n.name && (t.push(this.parseImportDefaultSpecifier()), !this.eat(n.comma))) return t;
        if (this.type === n.star) return t.push(this.parseImportNamespaceSpecifier()), t;
        for (this.expect(n.braceL); !this.eat(n.braceR); ) {
          if (e) e = !1;
          else if (this.expect(n.comma), this.afterTrailingComma(n.braceR)) break;
          t.push(this.parseImportSpecifier());
        }
        return t;
      }, m.parseWithClause = function() {
        var t = [];
        if (!this.eat(n._with)) return t;
        this.expect(n.braceL);
        for (var e = {}, s = !0; !this.eat(n.braceR); ) {
          if (s) s = !1;
          else if (this.expect(n.comma), this.afterTrailingComma(n.braceR)) break;
          var i = this.parseImportAttribute(), r = i.key.type === "Identifier" ? i.key.name : i.key.value;
          pt(e, r) && this.raiseRecoverable(i.key.start, "Duplicate attribute key '" + r + "'"), e[r] = !0, t.push(i);
        }
        return t;
      }, m.parseImportAttribute = function() {
        var t = this.startNode();
        return t.key = this.type === n.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never"), this.expect(n.colon), this.type !== n.string && this.unexpected(), t.value = this.parseExprAtom(), this.finishNode(t, "ImportAttribute");
      }, m.parseModuleExportName = function() {
        if (this.options.ecmaVersion >= 13 && this.type === n.string) {
          var t = this.parseLiteral(this.value);
          return Ks.test(t.value) && this.raise(t.start, "An export name cannot include a lone surrogate."), t;
        }
        return this.parseIdent(!0);
      }, m.adaptDirectivePrologue = function(t) {
        for (var e = 0; e < t.length && this.isDirectiveCandidate(t[e]); ++e) t[e].directive = t[e].expression.raw.slice(1, -1);
      }, m.isDirectiveCandidate = function(t) {
        return this.options.ecmaVersion >= 5 && t.type === "ExpressionStatement" && t.expression.type === "Literal" && typeof t.expression.value == "string" && (this.input[t.start] === '"' || this.input[t.start] === "'");
      };
      var F = P.prototype;
      F.toAssignable = function(t, e, s) {
        if (this.options.ecmaVersion >= 6 && t) switch (t.type) {
          case "Identifier":
            this.inAsync && t.name === "await" && this.raise(t.start, "Cannot use 'await' as identifier inside an async function");
            break;
          case "ObjectPattern":
          case "ArrayPattern":
          case "AssignmentPattern":
          case "RestElement":
            break;
          case "ObjectExpression":
            t.type = "ObjectPattern", s && this.checkPatternErrors(s, !0);
            for (var i = 0, r = t.properties; i < r.length; i += 1) {
              var a = r[i];
              this.toAssignable(a, e), a.type !== "RestElement" || a.argument.type !== "ArrayPattern" && a.argument.type !== "ObjectPattern" || this.raise(a.argument.start, "Unexpected token");
            }
            break;
          case "Property":
            t.kind !== "init" && this.raise(t.key.start, "Object pattern can't contain getter or setter"), this.toAssignable(t.value, e);
            break;
          case "ArrayExpression":
            t.type = "ArrayPattern", s && this.checkPatternErrors(s, !0), this.toAssignableList(t.elements, e);
            break;
          case "SpreadElement":
            t.type = "RestElement", this.toAssignable(t.argument, e), t.argument.type === "AssignmentPattern" && this.raise(t.argument.start, "Rest elements cannot have a default value");
            break;
          case "AssignmentExpression":
            t.operator !== "=" && this.raise(t.left.end, "Only '=' operator can be used for specifying default value."), t.type = "AssignmentPattern", delete t.operator, this.toAssignable(t.left, e);
            break;
          case "ParenthesizedExpression":
            this.toAssignable(t.expression, e, s);
            break;
          case "ChainExpression":
            this.raiseRecoverable(t.start, "Optional chaining cannot appear in left-hand side");
            break;
          case "MemberExpression":
            if (!e) break;
          default:
            this.raise(t.start, "Assigning to rvalue");
        }
        else s && this.checkPatternErrors(s, !0);
        return t;
      }, F.toAssignableList = function(t, e) {
        for (var s = t.length, i = 0; i < s; i++) {
          var r = t[i];
          r && this.toAssignable(r, e);
        }
        if (s) {
          var a = t[s - 1];
          this.options.ecmaVersion === 6 && e && a && a.type === "RestElement" && a.argument.type !== "Identifier" && this.unexpected(a.argument.start);
        }
        return t;
      }, F.parseSpread = function(t) {
        var e = this.startNode();
        return this.next(), e.argument = this.parseMaybeAssign(!1, t), this.finishNode(e, "SpreadElement");
      }, F.parseRestBinding = function() {
        var t = this.startNode();
        return this.next(), this.options.ecmaVersion === 6 && this.type !== n.name && this.unexpected(), t.argument = this.parseBindingAtom(), this.finishNode(t, "RestElement");
      }, F.parseBindingAtom = function() {
        if (this.options.ecmaVersion >= 6) switch (this.type) {
          case n.bracketL:
            var t = this.startNode();
            return this.next(), t.elements = this.parseBindingList(n.bracketR, !0, !0), this.finishNode(t, "ArrayPattern");
          case n.braceL:
            return this.parseObj(!0);
        }
        return this.parseIdent();
      }, F.parseBindingList = function(t, e, s, i) {
        for (var r = [], a = !0; !this.eat(t); ) if (a ? a = !1 : this.expect(n.comma), e && this.type === n.comma) r.push(null);
        else {
          if (s && this.afterTrailingComma(t)) break;
          if (this.type === n.ellipsis) {
            var o = this.parseRestBinding();
            this.parseBindingListItem(o), r.push(o), this.type === n.comma && this.raiseRecoverable(this.start, "Comma is not permitted after the rest element"), this.expect(t);
            break;
          }
          r.push(this.parseAssignableListItem(i));
        }
        return r;
      }, F.parseAssignableListItem = function(t) {
        var e = this.parseMaybeDefault(this.start, this.startLoc);
        return this.parseBindingListItem(e), e;
      }, F.parseBindingListItem = function(t) {
        return t;
      }, F.parseMaybeDefault = function(t, e, s) {
        if (s = s || this.parseBindingAtom(), this.options.ecmaVersion < 6 || !this.eat(n.eq)) return s;
        var i = this.startNodeAt(t, e);
        return i.left = s, i.right = this.parseMaybeAssign(), this.finishNode(i, "AssignmentPattern");
      }, F.checkLValSimple = function(t, e, s) {
        e === void 0 && (e = 0);
        var i = e !== 0;
        switch (t.type) {
          case "Identifier":
            this.strict && this.reservedWordsStrictBind.test(t.name) && this.raiseRecoverable(t.start, (i ? "Binding " : "Assigning to ") + t.name + " in strict mode"), i && (e === 2 && t.name === "let" && this.raiseRecoverable(t.start, "let is disallowed as a lexically bound name"), s && (pt(s, t.name) && this.raiseRecoverable(t.start, "Argument name clash"), s[t.name] = !0), e !== 5 && this.declareName(t.name, e, t.start));
            break;
          case "ChainExpression":
            this.raiseRecoverable(t.start, "Optional chaining cannot appear in left-hand side");
            break;
          case "MemberExpression":
            i && this.raiseRecoverable(t.start, "Binding member expression");
            break;
          case "ParenthesizedExpression":
            return i && this.raiseRecoverable(t.start, "Binding parenthesized expression"), this.checkLValSimple(t.expression, e, s);
          default:
            this.raise(t.start, (i ? "Binding" : "Assigning to") + " rvalue");
        }
      }, F.checkLValPattern = function(t, e, s) {
        switch (e === void 0 && (e = 0), t.type) {
          case "ObjectPattern":
            for (var i = 0, r = t.properties; i < r.length; i += 1) {
              var a = r[i];
              this.checkLValInnerPattern(a, e, s);
            }
            break;
          case "ArrayPattern":
            for (var o = 0, h = t.elements; o < h.length; o += 1) {
              var c = h[o];
              c && this.checkLValInnerPattern(c, e, s);
            }
            break;
          default:
            this.checkLValSimple(t, e, s);
        }
      }, F.checkLValInnerPattern = function(t, e, s) {
        switch (e === void 0 && (e = 0), t.type) {
          case "Property":
            this.checkLValInnerPattern(t.value, e, s);
            break;
          case "AssignmentPattern":
            this.checkLValPattern(t.left, e, s);
            break;
          case "RestElement":
            this.checkLValPattern(t.argument, e, s);
            break;
          default:
            this.checkLValPattern(t, e, s);
        }
      };
      var q = function(t, e, s, i, r) {
        this.token = t, this.isExpr = !!e, this.preserveSpace = !!s, this.override = i, this.generator = !!r;
      }, w = { b_stat: new q("{", !1), b_expr: new q("{", !0), b_tmpl: new q("${", !1), p_stat: new q("(", !1), p_expr: new q("(", !0), q_tmpl: new q("`", !0, !0, function(t) {
        return t.tryReadTemplateToken();
      }), f_stat: new q("function", !1), f_expr: new q("function", !0), f_expr_gen: new q("function", !0, !1, null, !0), f_gen: new q("function", !1, !1, null, !0) }, ut = P.prototype;
      ut.initialContext = function() {
        return [w.b_stat];
      }, ut.curContext = function() {
        return this.context[this.context.length - 1];
      }, ut.braceIsBlock = function(t) {
        var e = this.curContext();
        return e === w.f_expr || e === w.f_stat || (t !== n.colon || e !== w.b_stat && e !== w.b_expr ? t === n._return || t === n.name && this.exprAllowed ? U.test(this.input.slice(this.lastTokEnd, this.start)) : t === n._else || t === n.semi || t === n.eof || t === n.parenR || t === n.arrow || (t === n.braceL ? e === w.b_stat : t !== n._var && t !== n._const && t !== n.name && !this.exprAllowed) : !e.isExpr);
      }, ut.inGeneratorContext = function() {
        for (var t = this.context.length - 1; t >= 1; t--) {
          var e = this.context[t];
          if (e.token === "function") return e.generator;
        }
        return !1;
      }, ut.updateContext = function(t) {
        var e, s = this.type;
        s.keyword && t === n.dot ? this.exprAllowed = !1 : (e = s.updateContext) ? e.call(this, t) : this.exprAllowed = s.beforeExpr;
      }, ut.overrideContext = function(t) {
        this.curContext() !== t && (this.context[this.context.length - 1] = t);
      }, n.parenR.updateContext = n.braceR.updateContext = function() {
        if (this.context.length !== 1) {
          var t = this.context.pop();
          t === w.b_stat && this.curContext().token === "function" && (t = this.context.pop()), this.exprAllowed = !t.isExpr;
        } else this.exprAllowed = !0;
      }, n.braceL.updateContext = function(t) {
        this.context.push(this.braceIsBlock(t) ? w.b_stat : w.b_expr), this.exprAllowed = !0;
      }, n.dollarBraceL.updateContext = function() {
        this.context.push(w.b_tmpl), this.exprAllowed = !0;
      }, n.parenL.updateContext = function(t) {
        var e = t === n._if || t === n._for || t === n._with || t === n._while;
        this.context.push(e ? w.p_stat : w.p_expr), this.exprAllowed = !0;
      }, n.incDec.updateContext = function() {
      }, n._function.updateContext = n._class.updateContext = function(t) {
        !t.beforeExpr || t === n._else || t === n.semi && this.curContext() !== w.p_stat || t === n._return && U.test(this.input.slice(this.lastTokEnd, this.start)) || (t === n.colon || t === n.braceL) && this.curContext() === w.b_stat ? this.context.push(w.f_stat) : this.context.push(w.f_expr), this.exprAllowed = !1;
      }, n.colon.updateContext = function() {
        this.curContext().token === "function" && this.context.pop(), this.exprAllowed = !0;
      }, n.backQuote.updateContext = function() {
        this.curContext() === w.q_tmpl ? this.context.pop() : this.context.push(w.q_tmpl), this.exprAllowed = !1;
      }, n.star.updateContext = function(t) {
        if (t === n._function) {
          var e = this.context.length - 1;
          this.context[e] === w.f_expr ? this.context[e] = w.f_expr_gen : this.context[e] = w.f_gen;
        }
        this.exprAllowed = !0;
      }, n.name.updateContext = function(t) {
        var e = !1;
        this.options.ecmaVersion >= 6 && t !== n.dot && (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) && (e = !0), this.exprAllowed = e;
      };
      var x = P.prototype;
      function Pe(t) {
        return t.type === "Identifier" || t.type === "ParenthesizedExpression" && Pe(t.expression);
      }
      function Xt(t) {
        return t.type === "MemberExpression" && t.property.type === "PrivateIdentifier" || t.type === "ChainExpression" && Xt(t.expression) || t.type === "ParenthesizedExpression" && Xt(t.expression);
      }
      x.checkPropClash = function(t, e, s) {
        if (!(this.options.ecmaVersion >= 9 && t.type === "SpreadElement" || this.options.ecmaVersion >= 6 && (t.computed || t.method || t.shorthand))) {
          var i, r = t.key;
          switch (r.type) {
            case "Identifier":
              i = r.name;
              break;
            case "Literal":
              i = String(r.value);
              break;
            default:
              return;
          }
          var a = t.kind;
          if (this.options.ecmaVersion >= 6) i === "__proto__" && a === "init" && (e.proto && (s ? s.doubleProto < 0 && (s.doubleProto = r.start) : this.raiseRecoverable(r.start, "Redefinition of __proto__ property")), e.proto = !0);
          else {
            var o = e[i = "$" + i];
            o ? (a === "init" ? this.strict && o.init || o.get || o.set : o.init || o[a]) && this.raiseRecoverable(r.start, "Redefinition of property") : o = e[i] = { init: !1, get: !1, set: !1 }, o[a] = !0;
          }
        }
      }, x.parseExpression = function(t, e) {
        var s = this.start, i = this.startLoc, r = this.parseMaybeAssign(t, e);
        if (this.type === n.comma) {
          var a = this.startNodeAt(s, i);
          for (a.expressions = [r]; this.eat(n.comma); ) a.expressions.push(this.parseMaybeAssign(t, e));
          return this.finishNode(a, "SequenceExpression");
        }
        return r;
      }, x.parseMaybeAssign = function(t, e, s) {
        if (this.isContextual("yield")) {
          if (this.inGenerator) return this.parseYield(t);
          this.exprAllowed = !1;
        }
        var i = !1, r = -1, a = -1, o = -1;
        e ? (r = e.parenthesizedAssign, a = e.trailingComma, o = e.doubleProto, e.parenthesizedAssign = e.trailingComma = -1) : (e = new Pt(), i = !0);
        var h = this.start, c = this.startLoc;
        this.type !== n.parenL && this.type !== n.name || (this.potentialArrowAt = this.start, this.potentialArrowInForAwait = t === "await");
        var p = this.parseMaybeConditional(t, e);
        if (s && (p = s.call(this, p, h, c)), this.type.isAssign) {
          var l = this.startNodeAt(h, c);
          return l.operator = this.value, this.type === n.eq && (p = this.toAssignable(p, !1, e)), i || (e.parenthesizedAssign = e.trailingComma = e.doubleProto = -1), e.shorthandAssign >= p.start && (e.shorthandAssign = -1), this.type === n.eq ? this.checkLValPattern(p) : this.checkLValSimple(p), l.left = p, this.next(), l.right = this.parseMaybeAssign(t), o > -1 && (e.doubleProto = o), this.finishNode(l, "AssignmentExpression");
        }
        return i && this.checkExpressionErrors(e, !0), r > -1 && (e.parenthesizedAssign = r), a > -1 && (e.trailingComma = a), p;
      }, x.parseMaybeConditional = function(t, e) {
        var s = this.start, i = this.startLoc, r = this.parseExprOps(t, e);
        if (this.checkExpressionErrors(e)) return r;
        if (this.eat(n.question)) {
          var a = this.startNodeAt(s, i);
          return a.test = r, a.consequent = this.parseMaybeAssign(), this.expect(n.colon), a.alternate = this.parseMaybeAssign(t), this.finishNode(a, "ConditionalExpression");
        }
        return r;
      }, x.parseExprOps = function(t, e) {
        var s = this.start, i = this.startLoc, r = this.parseMaybeUnary(e, !1, !1, t);
        return this.checkExpressionErrors(e) || r.start === s && r.type === "ArrowFunctionExpression" ? r : this.parseExprOp(r, s, i, -1, t);
      }, x.parseExprOp = function(t, e, s, i, r) {
        var a = this.type.binop;
        if (a != null && (!r || this.type !== n._in) && a > i) {
          var o = this.type === n.logicalOR || this.type === n.logicalAND, h = this.type === n.coalesce;
          h && (a = n.logicalAND.binop);
          var c = this.value;
          this.next();
          var p = this.start, l = this.startLoc, f = this.parseExprOp(this.parseMaybeUnary(null, !1, !1, r), p, l, a, r), u = this.buildBinary(e, s, t, f, c, o || h);
          return (o && this.type === n.coalesce || h && (this.type === n.logicalOR || this.type === n.logicalAND)) && this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses"), this.parseExprOp(u, e, s, i, r);
        }
        return t;
      }, x.buildBinary = function(t, e, s, i, r, a) {
        i.type === "PrivateIdentifier" && this.raise(i.start, "Private identifier can only be left side of binary expression");
        var o = this.startNodeAt(t, e);
        return o.left = s, o.operator = r, o.right = i, this.finishNode(o, a ? "LogicalExpression" : "BinaryExpression");
      }, x.parseMaybeUnary = function(t, e, s, i) {
        var r, a = this.start, o = this.startLoc;
        if (this.isContextual("await") && this.canAwait) r = this.parseAwait(i), e = !0;
        else if (this.type.prefix) {
          var h = this.startNode(), c = this.type === n.incDec;
          h.operator = this.value, h.prefix = !0, this.next(), h.argument = this.parseMaybeUnary(null, !0, c, i), this.checkExpressionErrors(t, !0), c ? this.checkLValSimple(h.argument) : this.strict && h.operator === "delete" && Pe(h.argument) ? this.raiseRecoverable(h.start, "Deleting local variable in strict mode") : h.operator === "delete" && Xt(h.argument) ? this.raiseRecoverable(h.start, "Private fields can not be deleted") : e = !0, r = this.finishNode(h, c ? "UpdateExpression" : "UnaryExpression");
        } else if (e || this.type !== n.privateId) {
          if (r = this.parseExprSubscripts(t, i), this.checkExpressionErrors(t)) return r;
          for (; this.type.postfix && !this.canInsertSemicolon(); ) {
            var p = this.startNodeAt(a, o);
            p.operator = this.value, p.prefix = !1, p.argument = r, this.checkLValSimple(r), this.next(), r = this.finishNode(p, "UpdateExpression");
          }
        } else (i || this.privateNameStack.length === 0) && this.options.checkPrivateFields && this.unexpected(), r = this.parsePrivateIdent(), this.type !== n._in && this.unexpected();
        return s || !this.eat(n.starstar) ? r : e ? void this.unexpected(this.lastTokStart) : this.buildBinary(a, o, r, this.parseMaybeUnary(null, !1, !1, i), "**", !1);
      }, x.parseExprSubscripts = function(t, e) {
        var s = this.start, i = this.startLoc, r = this.parseExprAtom(t, e);
        if (r.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") return r;
        var a = this.parseSubscripts(r, s, i, !1, e);
        return t && a.type === "MemberExpression" && (t.parenthesizedAssign >= a.start && (t.parenthesizedAssign = -1), t.parenthesizedBind >= a.start && (t.parenthesizedBind = -1), t.trailingComma >= a.start && (t.trailingComma = -1)), a;
      }, x.parseSubscripts = function(t, e, s, i, r) {
        for (var a = this.options.ecmaVersion >= 8 && t.type === "Identifier" && t.name === "async" && this.lastTokEnd === t.end && !this.canInsertSemicolon() && t.end - t.start === 5 && this.potentialArrowAt === t.start, o = !1; ; ) {
          var h = this.parseSubscript(t, e, s, i, a, o, r);
          if (h.optional && (o = !0), h === t || h.type === "ArrowFunctionExpression") {
            if (o) {
              var c = this.startNodeAt(e, s);
              c.expression = h, h = this.finishNode(c, "ChainExpression");
            }
            return h;
          }
          t = h;
        }
      }, x.shouldParseAsyncArrow = function() {
        return !this.canInsertSemicolon() && this.eat(n.arrow);
      }, x.parseSubscriptAsyncArrow = function(t, e, s, i) {
        return this.parseArrowExpression(this.startNodeAt(t, e), s, !0, i);
      }, x.parseSubscript = function(t, e, s, i, r, a, o) {
        var h = this.options.ecmaVersion >= 11, c = h && this.eat(n.questionDot);
        i && c && this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
        var p = this.eat(n.bracketL);
        if (p || c && this.type !== n.parenL && this.type !== n.backQuote || this.eat(n.dot)) {
          var l = this.startNodeAt(e, s);
          l.object = t, p ? (l.property = this.parseExpression(), this.expect(n.bracketR)) : this.type === n.privateId && t.type !== "Super" ? l.property = this.parsePrivateIdent() : l.property = this.parseIdent(this.options.allowReserved !== "never"), l.computed = !!p, h && (l.optional = c), t = this.finishNode(l, "MemberExpression");
        } else if (!i && this.eat(n.parenL)) {
          var f = new Pt(), u = this.yieldPos, v = this.awaitPos, k = this.awaitIdentPos;
          this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0;
          var y = this.parseExprList(n.parenR, this.options.ecmaVersion >= 8, !1, f);
          if (r && !c && this.shouldParseAsyncArrow()) return this.checkPatternErrors(f, !1), this.checkYieldAwaitInDefaultParams(), this.awaitIdentPos > 0 && this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"), this.yieldPos = u, this.awaitPos = v, this.awaitIdentPos = k, this.parseSubscriptAsyncArrow(e, s, y, o);
          this.checkExpressionErrors(f, !0), this.yieldPos = u || this.yieldPos, this.awaitPos = v || this.awaitPos, this.awaitIdentPos = k || this.awaitIdentPos;
          var C = this.startNodeAt(e, s);
          C.callee = t, C.arguments = y, h && (C.optional = c), t = this.finishNode(C, "CallExpression");
        } else if (this.type === n.backQuote) {
          (c || a) && this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
          var S = this.startNodeAt(e, s);
          S.tag = t, S.quasi = this.parseTemplate({ isTagged: !0 }), t = this.finishNode(S, "TaggedTemplateExpression");
        }
        return t;
      }, x.parseExprAtom = function(t, e, s) {
        this.type === n.slash && this.readRegexp();
        var i, r = this.potentialArrowAt === this.start;
        switch (this.type) {
          case n._super:
            return this.allowSuper || this.raise(this.start, "'super' keyword outside a method"), i = this.startNode(), this.next(), this.type !== n.parenL || this.allowDirectSuper || this.raise(i.start, "super() call outside constructor of a subclass"), this.type !== n.dot && this.type !== n.bracketL && this.type !== n.parenL && this.unexpected(), this.finishNode(i, "Super");
          case n._this:
            return i = this.startNode(), this.next(), this.finishNode(i, "ThisExpression");
          case n.name:
            var a = this.start, o = this.startLoc, h = this.containsEsc, c = this.parseIdent(!1);
            if (this.options.ecmaVersion >= 8 && !h && c.name === "async" && !this.canInsertSemicolon() && this.eat(n._function)) return this.overrideContext(w.f_expr), this.parseFunction(this.startNodeAt(a, o), 0, !1, !0, e);
            if (r && !this.canInsertSemicolon()) {
              if (this.eat(n.arrow)) return this.parseArrowExpression(this.startNodeAt(a, o), [c], !1, e);
              if (this.options.ecmaVersion >= 8 && c.name === "async" && this.type === n.name && !h && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) return c = this.parseIdent(!1), !this.canInsertSemicolon() && this.eat(n.arrow) || this.unexpected(), this.parseArrowExpression(this.startNodeAt(a, o), [c], !0, e);
            }
            return c;
          case n.regexp:
            var p = this.value;
            return (i = this.parseLiteral(p.value)).regex = { pattern: p.pattern, flags: p.flags }, i;
          case n.num:
          case n.string:
            return this.parseLiteral(this.value);
          case n._null:
          case n._true:
          case n._false:
            return (i = this.startNode()).value = this.type === n._null ? null : this.type === n._true, i.raw = this.type.keyword, this.next(), this.finishNode(i, "Literal");
          case n.parenL:
            var l = this.start, f = this.parseParenAndDistinguishExpression(r, e);
            return t && (t.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(f) && (t.parenthesizedAssign = l), t.parenthesizedBind < 0 && (t.parenthesizedBind = l)), f;
          case n.bracketL:
            return i = this.startNode(), this.next(), i.elements = this.parseExprList(n.bracketR, !0, !0, t), this.finishNode(i, "ArrayExpression");
          case n.braceL:
            return this.overrideContext(w.b_expr), this.parseObj(!1, t);
          case n._function:
            return i = this.startNode(), this.next(), this.parseFunction(i, 0);
          case n._class:
            return this.parseClass(this.startNode(), !1);
          case n._new:
            return this.parseNew();
          case n.backQuote:
            return this.parseTemplate();
          case n._import:
            return this.options.ecmaVersion >= 11 ? this.parseExprImport(s) : this.unexpected();
          default:
            return this.parseExprAtomDefault();
        }
      }, x.parseExprAtomDefault = function() {
        this.unexpected();
      }, x.parseExprImport = function(t) {
        var e = this.startNode();
        if (this.containsEsc && this.raiseRecoverable(this.start, "Escape sequence in keyword import"), this.next(), this.type === n.parenL && !t) return this.parseDynamicImport(e);
        if (this.type === n.dot) {
          var s = this.startNodeAt(e.start, e.loc && e.loc.start);
          return s.name = "import", e.meta = this.finishNode(s, "Identifier"), this.parseImportMeta(e);
        }
        this.unexpected();
      }, x.parseDynamicImport = function(t) {
        if (this.next(), t.source = this.parseMaybeAssign(), this.options.ecmaVersion >= 16) this.eat(n.parenR) ? t.options = null : (this.expect(n.comma), this.afterTrailingComma(n.parenR) ? t.options = null : (t.options = this.parseMaybeAssign(), this.eat(n.parenR) || (this.expect(n.comma), this.afterTrailingComma(n.parenR) || this.unexpected())));
        else if (!this.eat(n.parenR)) {
          var e = this.start;
          this.eat(n.comma) && this.eat(n.parenR) ? this.raiseRecoverable(e, "Trailing comma is not allowed in import()") : this.unexpected(e);
        }
        return this.finishNode(t, "ImportExpression");
      }, x.parseImportMeta = function(t) {
        this.next();
        var e = this.containsEsc;
        return t.property = this.parseIdent(!0), t.property.name !== "meta" && this.raiseRecoverable(t.property.start, "The only valid meta property for import is 'import.meta'"), e && this.raiseRecoverable(t.start, "'import.meta' must not contain escaped characters"), this.options.sourceType === "module" || this.options.allowImportExportEverywhere || this.raiseRecoverable(t.start, "Cannot use 'import.meta' outside a module"), this.finishNode(t, "MetaProperty");
      }, x.parseLiteral = function(t) {
        var e = this.startNode();
        return e.value = t, e.raw = this.input.slice(this.start, this.end), e.raw.charCodeAt(e.raw.length - 1) === 110 && (e.bigint = e.value != null ? e.value.toString() : e.raw.slice(0, -1).replace(/_/g, "")), this.next(), this.finishNode(e, "Literal");
      }, x.parseParenExpression = function() {
        this.expect(n.parenL);
        var t = this.parseExpression();
        return this.expect(n.parenR), t;
      }, x.shouldParseArrow = function(t) {
        return !this.canInsertSemicolon();
      }, x.parseParenAndDistinguishExpression = function(t, e) {
        var s, i = this.start, r = this.startLoc, a = this.options.ecmaVersion >= 8;
        if (this.options.ecmaVersion >= 6) {
          this.next();
          var o, h = this.start, c = this.startLoc, p = [], l = !0, f = !1, u = new Pt(), v = this.yieldPos, k = this.awaitPos;
          for (this.yieldPos = 0, this.awaitPos = 0; this.type !== n.parenR; ) {
            if (l ? l = !1 : this.expect(n.comma), a && this.afterTrailingComma(n.parenR, !0)) {
              f = !0;
              break;
            }
            if (this.type === n.ellipsis) {
              o = this.start, p.push(this.parseParenItem(this.parseRestBinding())), this.type === n.comma && this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
              break;
            }
            p.push(this.parseMaybeAssign(!1, u, this.parseParenItem));
          }
          var y = this.lastTokEnd, C = this.lastTokEndLoc;
          if (this.expect(n.parenR), t && this.shouldParseArrow(p) && this.eat(n.arrow)) return this.checkPatternErrors(u, !1), this.checkYieldAwaitInDefaultParams(), this.yieldPos = v, this.awaitPos = k, this.parseParenArrowList(i, r, p, e);
          p.length && !f || this.unexpected(this.lastTokStart), o && this.unexpected(o), this.checkExpressionErrors(u, !0), this.yieldPos = v || this.yieldPos, this.awaitPos = k || this.awaitPos, p.length > 1 ? ((s = this.startNodeAt(h, c)).expressions = p, this.finishNodeAt(s, "SequenceExpression", y, C)) : s = p[0];
        } else s = this.parseParenExpression();
        if (this.options.preserveParens) {
          var S = this.startNodeAt(i, r);
          return S.expression = s, this.finishNode(S, "ParenthesizedExpression");
        }
        return s;
      }, x.parseParenItem = function(t) {
        return t;
      }, x.parseParenArrowList = function(t, e, s, i) {
        return this.parseArrowExpression(this.startNodeAt(t, e), s, !1, i);
      };
      var ti = [];
      x.parseNew = function() {
        this.containsEsc && this.raiseRecoverable(this.start, "Escape sequence in keyword new");
        var t = this.startNode();
        if (this.next(), this.options.ecmaVersion >= 6 && this.type === n.dot) {
          var e = this.startNodeAt(t.start, t.loc && t.loc.start);
          e.name = "new", t.meta = this.finishNode(e, "Identifier"), this.next();
          var s = this.containsEsc;
          return t.property = this.parseIdent(!0), t.property.name !== "target" && this.raiseRecoverable(t.property.start, "The only valid meta property for new is 'new.target'"), s && this.raiseRecoverable(t.start, "'new.target' must not contain escaped characters"), this.allowNewDotTarget || this.raiseRecoverable(t.start, "'new.target' can only be used in functions and class static block"), this.finishNode(t, "MetaProperty");
        }
        var i = this.start, r = this.startLoc;
        return t.callee = this.parseSubscripts(this.parseExprAtom(null, !1, !0), i, r, !0, !1), this.eat(n.parenL) ? t.arguments = this.parseExprList(n.parenR, this.options.ecmaVersion >= 8, !1) : t.arguments = ti, this.finishNode(t, "NewExpression");
      }, x.parseTemplateElement = function(t) {
        var e = t.isTagged, s = this.startNode();
        return this.type === n.invalidTemplate ? (e || this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal"), s.value = { raw: this.value.replace(/\r\n?/g, `
`), cooked: null }) : s.value = { raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, `
`), cooked: this.value }, this.next(), s.tail = this.type === n.backQuote, this.finishNode(s, "TemplateElement");
      }, x.parseTemplate = function(t) {
        t === void 0 && (t = {});
        var e = t.isTagged;
        e === void 0 && (e = !1);
        var s = this.startNode();
        this.next(), s.expressions = [];
        var i = this.parseTemplateElement({ isTagged: e });
        for (s.quasis = [i]; !i.tail; ) this.type === n.eof && this.raise(this.pos, "Unterminated template literal"), this.expect(n.dollarBraceL), s.expressions.push(this.parseExpression()), this.expect(n.braceR), s.quasis.push(i = this.parseTemplateElement({ isTagged: e }));
        return this.next(), this.finishNode(s, "TemplateLiteral");
      }, x.isAsyncProp = function(t) {
        return !t.computed && t.key.type === "Identifier" && t.key.name === "async" && (this.type === n.name || this.type === n.num || this.type === n.string || this.type === n.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === n.star) && !U.test(this.input.slice(this.lastTokEnd, this.start));
      }, x.parseObj = function(t, e) {
        var s = this.startNode(), i = !0, r = {};
        for (s.properties = [], this.next(); !this.eat(n.braceR); ) {
          if (i) i = !1;
          else if (this.expect(n.comma), this.options.ecmaVersion >= 5 && this.afterTrailingComma(n.braceR)) break;
          var a = this.parseProperty(t, e);
          t || this.checkPropClash(a, r, e), s.properties.push(a);
        }
        return this.finishNode(s, t ? "ObjectPattern" : "ObjectExpression");
      }, x.parseProperty = function(t, e) {
        var s, i, r, a, o = this.startNode();
        if (this.options.ecmaVersion >= 9 && this.eat(n.ellipsis)) return t ? (o.argument = this.parseIdent(!1), this.type === n.comma && this.raiseRecoverable(this.start, "Comma is not permitted after the rest element"), this.finishNode(o, "RestElement")) : (o.argument = this.parseMaybeAssign(!1, e), this.type === n.comma && e && e.trailingComma < 0 && (e.trailingComma = this.start), this.finishNode(o, "SpreadElement"));
        this.options.ecmaVersion >= 6 && (o.method = !1, o.shorthand = !1, (t || e) && (r = this.start, a = this.startLoc), t || (s = this.eat(n.star)));
        var h = this.containsEsc;
        return this.parsePropertyName(o), !t && !h && this.options.ecmaVersion >= 8 && !s && this.isAsyncProp(o) ? (i = !0, s = this.options.ecmaVersion >= 9 && this.eat(n.star), this.parsePropertyName(o)) : i = !1, this.parsePropertyValue(o, t, s, i, r, a, e, h), this.finishNode(o, "Property");
      }, x.parseGetterSetter = function(t) {
        var e = t.key.name;
        this.parsePropertyName(t), t.value = this.parseMethod(!1), t.kind = e;
        var s = t.kind === "get" ? 0 : 1;
        if (t.value.params.length !== s) {
          var i = t.value.start;
          t.kind === "get" ? this.raiseRecoverable(i, "getter should have no params") : this.raiseRecoverable(i, "setter should have exactly one param");
        } else t.kind === "set" && t.value.params[0].type === "RestElement" && this.raiseRecoverable(t.value.params[0].start, "Setter cannot use rest params");
      }, x.parsePropertyValue = function(t, e, s, i, r, a, o, h) {
        (s || i) && this.type === n.colon && this.unexpected(), this.eat(n.colon) ? (t.value = e ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(!1, o), t.kind = "init") : this.options.ecmaVersion >= 6 && this.type === n.parenL ? (e && this.unexpected(), t.method = !0, t.value = this.parseMethod(s, i), t.kind = "init") : e || h || !(this.options.ecmaVersion >= 5) || t.computed || t.key.type !== "Identifier" || t.key.name !== "get" && t.key.name !== "set" || this.type === n.comma || this.type === n.braceR || this.type === n.eq ? this.options.ecmaVersion >= 6 && !t.computed && t.key.type === "Identifier" ? ((s || i) && this.unexpected(), this.checkUnreserved(t.key), t.key.name !== "await" || this.awaitIdentPos || (this.awaitIdentPos = r), e ? t.value = this.parseMaybeDefault(r, a, this.copyNode(t.key)) : this.type === n.eq && o ? (o.shorthandAssign < 0 && (o.shorthandAssign = this.start), t.value = this.parseMaybeDefault(r, a, this.copyNode(t.key))) : t.value = this.copyNode(t.key), t.kind = "init", t.shorthand = !0) : this.unexpected() : ((s || i) && this.unexpected(), this.parseGetterSetter(t));
      }, x.parsePropertyName = function(t) {
        if (this.options.ecmaVersion >= 6) {
          if (this.eat(n.bracketL)) return t.computed = !0, t.key = this.parseMaybeAssign(), this.expect(n.bracketR), t.key;
          t.computed = !1;
        }
        return t.key = this.type === n.num || this.type === n.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
      }, x.initFunction = function(t) {
        t.id = null, this.options.ecmaVersion >= 6 && (t.generator = t.expression = !1), this.options.ecmaVersion >= 8 && (t.async = !1);
      }, x.parseMethod = function(t, e, s) {
        var i = this.startNode(), r = this.yieldPos, a = this.awaitPos, o = this.awaitIdentPos;
        return this.initFunction(i), this.options.ecmaVersion >= 6 && (i.generator = t), this.options.ecmaVersion >= 8 && (i.async = !!e), this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0, this.enterScope(64 | Yt(e, i.generator) | (s ? 128 : 0)), this.expect(n.parenL), i.params = this.parseBindingList(n.parenR, !1, this.options.ecmaVersion >= 8), this.checkYieldAwaitInDefaultParams(), this.parseFunctionBody(i, !1, !0, !1), this.yieldPos = r, this.awaitPos = a, this.awaitIdentPos = o, this.finishNode(i, "FunctionExpression");
      }, x.parseArrowExpression = function(t, e, s, i) {
        var r = this.yieldPos, a = this.awaitPos, o = this.awaitIdentPos;
        return this.enterScope(16 | Yt(s, !1)), this.initFunction(t), this.options.ecmaVersion >= 8 && (t.async = !!s), this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0, t.params = this.toAssignableList(e, !0), this.parseFunctionBody(t, !0, !1, i), this.yieldPos = r, this.awaitPos = a, this.awaitIdentPos = o, this.finishNode(t, "ArrowFunctionExpression");
      }, x.parseFunctionBody = function(t, e, s, i) {
        var r = e && this.type !== n.braceL, a = this.strict, o = !1;
        if (r) t.body = this.parseMaybeAssign(i), t.expression = !0, this.checkParams(t, !1);
        else {
          var h = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(t.params);
          a && !h || (o = this.strictDirective(this.end)) && h && this.raiseRecoverable(t.start, "Illegal 'use strict' directive in function with non-simple parameter list");
          var c = this.labels;
          this.labels = [], o && (this.strict = !0), this.checkParams(t, !a && !o && !e && !s && this.isSimpleParamList(t.params)), this.strict && t.id && this.checkLValSimple(t.id, 5), t.body = this.parseBlock(!1, void 0, o && !a), t.expression = !1, this.adaptDirectivePrologue(t.body.body), this.labels = c;
        }
        this.exitScope();
      }, x.isSimpleParamList = function(t) {
        for (var e = 0, s = t; e < s.length; e += 1)
          if (s[e].type !== "Identifier") return !1;
        return !0;
      }, x.checkParams = function(t, e) {
        for (var s = /* @__PURE__ */ Object.create(null), i = 0, r = t.params; i < r.length; i += 1) {
          var a = r[i];
          this.checkLValInnerPattern(a, 1, e ? null : s);
        }
      }, x.parseExprList = function(t, e, s, i) {
        for (var r = [], a = !0; !this.eat(t); ) {
          if (a) a = !1;
          else if (this.expect(n.comma), e && this.afterTrailingComma(t)) break;
          var o = void 0;
          s && this.type === n.comma ? o = null : this.type === n.ellipsis ? (o = this.parseSpread(i), i && this.type === n.comma && i.trailingComma < 0 && (i.trailingComma = this.start)) : o = this.parseMaybeAssign(!1, i), r.push(o);
        }
        return r;
      }, x.checkUnreserved = function(t) {
        var e = t.start, s = t.end, i = t.name;
        this.inGenerator && i === "yield" && this.raiseRecoverable(e, "Cannot use 'yield' as identifier inside a generator"), this.inAsync && i === "await" && this.raiseRecoverable(e, "Cannot use 'await' as identifier inside an async function"), this.currentThisScope().flags & Te || i !== "arguments" || this.raiseRecoverable(e, "Cannot use 'arguments' in class field initializer"), !this.inClassStaticBlock || i !== "arguments" && i !== "await" || this.raise(e, "Cannot use " + i + " in class static initialization block"), this.keywords.test(i) && this.raise(e, "Unexpected keyword '" + i + "'"), this.options.ecmaVersion < 6 && this.input.slice(e, s).indexOf("\\") !== -1 || (this.strict ? this.reservedWordsStrict : this.reservedWords).test(i) && (this.inAsync || i !== "await" || this.raiseRecoverable(e, "Cannot use keyword 'await' outside an async function"), this.raiseRecoverable(e, "The keyword '" + i + "' is reserved"));
      }, x.parseIdent = function(t) {
        var e = this.parseIdentNode();
        return this.next(!!t), this.finishNode(e, "Identifier"), t || (this.checkUnreserved(e), e.name !== "await" || this.awaitIdentPos || (this.awaitIdentPos = e.start)), e;
      }, x.parseIdentNode = function() {
        var t = this.startNode();
        return this.type === n.name ? t.name = this.value : this.type.keyword ? (t.name = this.type.keyword, t.name !== "class" && t.name !== "function" || this.lastTokEnd === this.lastTokStart + 1 && this.input.charCodeAt(this.lastTokStart) === 46 || this.context.pop(), this.type = n.name) : this.unexpected(), t;
      }, x.parsePrivateIdent = function() {
        var t = this.startNode();
        return this.type === n.privateId ? t.name = this.value : this.unexpected(), this.next(), this.finishNode(t, "PrivateIdentifier"), this.options.checkPrivateFields && (this.privateNameStack.length === 0 ? this.raise(t.start, "Private field '#" + t.name + "' must be declared in an enclosing class") : this.privateNameStack[this.privateNameStack.length - 1].used.push(t)), t;
      }, x.parseYield = function(t) {
        this.yieldPos || (this.yieldPos = this.start);
        var e = this.startNode();
        return this.next(), this.type === n.semi || this.canInsertSemicolon() || this.type !== n.star && !this.type.startsExpr ? (e.delegate = !1, e.argument = null) : (e.delegate = this.eat(n.star), e.argument = this.parseMaybeAssign(t)), this.finishNode(e, "YieldExpression");
      }, x.parseAwait = function(t) {
        this.awaitPos || (this.awaitPos = this.start);
        var e = this.startNode();
        return this.next(), e.argument = this.parseMaybeUnary(null, !0, !1, t), this.finishNode(e, "AwaitExpression");
      };
      var Lt = P.prototype;
      Lt.raise = function(t, e) {
        var s = Re(this.input, t);
        e += " (" + s.line + ":" + s.column + ")", this.sourceFile && (e += " in " + this.sourceFile);
        var i = new SyntaxError(e);
        throw i.pos = t, i.loc = s, i.raisedAt = this.pos, i;
      }, Lt.raiseRecoverable = Lt.raise, Lt.curPosition = function() {
        if (this.options.locations) return new bt(this.curLine, this.pos - this.lineStart);
      };
      var X = P.prototype, ei = function(t) {
        this.flags = t, this.var = [], this.lexical = [], this.functions = [];
      };
      X.enterScope = function(t) {
        this.scopeStack.push(new ei(t));
      }, X.exitScope = function() {
        this.scopeStack.pop();
      }, X.treatFunctionsAsVarInScope = function(t) {
        return 2 & t.flags || !this.inModule && 1 & t.flags;
      }, X.declareName = function(t, e, s) {
        var i = !1;
        if (e === 2) {
          var r = this.currentScope();
          i = r.lexical.indexOf(t) > -1 || r.functions.indexOf(t) > -1 || r.var.indexOf(t) > -1, r.lexical.push(t), this.inModule && 1 & r.flags && delete this.undefinedExports[t];
        } else if (e === 4)
          this.currentScope().lexical.push(t);
        else if (e === 3) {
          var a = this.currentScope();
          i = this.treatFunctionsAsVar ? a.lexical.indexOf(t) > -1 : a.lexical.indexOf(t) > -1 || a.var.indexOf(t) > -1, a.functions.push(t);
        } else for (var o = this.scopeStack.length - 1; o >= 0; --o) {
          var h = this.scopeStack[o];
          if (h.lexical.indexOf(t) > -1 && !(32 & h.flags && h.lexical[0] === t) || !this.treatFunctionsAsVarInScope(h) && h.functions.indexOf(t) > -1) {
            i = !0;
            break;
          }
          if (h.var.push(t), this.inModule && 1 & h.flags && delete this.undefinedExports[t], h.flags & Te) break;
        }
        i && this.raiseRecoverable(s, "Identifier '" + t + "' has already been declared");
      }, X.checkLocalExport = function(t) {
        this.scopeStack[0].lexical.indexOf(t.name) === -1 && this.scopeStack[0].var.indexOf(t.name) === -1 && (this.undefinedExports[t.name] = t);
      }, X.currentScope = function() {
        return this.scopeStack[this.scopeStack.length - 1];
      }, X.currentVarScope = function() {
        for (var t = this.scopeStack.length - 1; ; t--) {
          var e = this.scopeStack[t];
          if (771 & e.flags) return e;
        }
      }, X.currentThisScope = function() {
        for (var t = this.scopeStack.length - 1; ; t--) {
          var e = this.scopeStack[t];
          if (771 & e.flags && !(16 & e.flags)) return e;
        }
      };
      var Ot = function(t, e, s) {
        this.type = "", this.start = e, this.end = 0, t.options.locations && (this.loc = new Tt(t, s)), t.options.directSourceFile && (this.sourceFile = t.options.directSourceFile), t.options.ranges && (this.range = [e, 0]);
      }, Ct = P.prototype;
      function Ne(t, e, s, i) {
        return t.type = e, t.end = s, this.options.locations && (t.loc.end = i), this.options.ranges && (t.range[1] = s), t;
      }
      Ct.startNode = function() {
        return new Ot(this, this.start, this.startLoc);
      }, Ct.startNodeAt = function(t, e) {
        return new Ot(this, t, e);
      }, Ct.finishNode = function(t, e) {
        return Ne.call(this, t, e, this.lastTokEnd, this.lastTokEndLoc);
      }, Ct.finishNodeAt = function(t, e, s, i) {
        return Ne.call(this, t, e, s, i);
      }, Ct.copyNode = function(t) {
        var e = new Ot(this, t.start, this.startLoc);
        for (var s in t) e[s] = t[s];
        return e;
      };
      var Le = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS", te = Le + " Extended_Pictographic", ee = te + " EBase EComp EMod EPres ExtPict", si = { 9: Le, 10: te, 11: te, 12: ee, 13: ee, 14: ee }, ii = { 9: "", 10: "", 11: "", 12: "", 13: "", 14: "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji" }, Oe = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu", De = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb", Ve = De + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd", Ue = Ve + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho", Me = Ue + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi", je = Me + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith", ri = { 9: De, 10: Ve, 11: Ue, 12: Me, 13: je, 14: je + " Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sunu Sunuwar Todhri Todr Tulu_Tigalari Tutg Unknown Zzzz" }, Be = {};
      function ni(t) {
        var e = Be[t] = { binary: Z(si[t] + " " + Oe), binaryOfStrings: Z(ii[t]), nonBinary: { General_Category: Z(Oe), Script: Z(ri[t]) } };
        e.nonBinary.Script_Extensions = e.nonBinary.Script, e.nonBinary.gc = e.nonBinary.General_Category, e.nonBinary.sc = e.nonBinary.Script, e.nonBinary.scx = e.nonBinary.Script_Extensions;
      }
      for (var se = 0, Fe = [9, 10, 11, 12, 13, 14]; se < Fe.length; se += 1)
        ni(Fe[se]);
      var d = P.prototype, Dt = function(t, e) {
        this.parent = t, this.base = e || this;
      };
      Dt.prototype.separatedFrom = function(t) {
        for (var e = this; e; e = e.parent) for (var s = t; s; s = s.parent) if (e.base === s.base && e !== s) return !0;
        return !1;
      }, Dt.prototype.sibling = function() {
        return new Dt(this.parent, this.base);
      };
      var K = function(t) {
        this.parser = t, this.validFlags = "gim" + (t.options.ecmaVersion >= 6 ? "uy" : "") + (t.options.ecmaVersion >= 9 ? "s" : "") + (t.options.ecmaVersion >= 13 ? "d" : "") + (t.options.ecmaVersion >= 15 ? "v" : ""), this.unicodeProperties = Be[t.options.ecmaVersion >= 14 ? 14 : t.options.ecmaVersion], this.source = "", this.flags = "", this.start = 0, this.switchU = !1, this.switchV = !1, this.switchN = !1, this.pos = 0, this.lastIntValue = 0, this.lastStringValue = "", this.lastAssertionIsQuantifiable = !1, this.numCapturingParens = 0, this.maxBackReference = 0, this.groupNames = /* @__PURE__ */ Object.create(null), this.backReferenceNames = [], this.branchID = null;
      };
      function ai(t) {
        return t === 105 || t === 109 || t === 115;
      }
      function $e(t) {
        return t === 36 || t >= 40 && t <= 43 || t === 46 || t === 63 || t >= 91 && t <= 94 || t >= 123 && t <= 125;
      }
      function qe(t) {
        return t >= 65 && t <= 90 || t >= 97 && t <= 122;
      }
      K.prototype.reset = function(t, e, s) {
        var i = s.indexOf("v") !== -1, r = s.indexOf("u") !== -1;
        this.start = 0 | t, this.source = e + "", this.flags = s, i && this.parser.options.ecmaVersion >= 15 ? (this.switchU = !0, this.switchV = !0, this.switchN = !0) : (this.switchU = r && this.parser.options.ecmaVersion >= 6, this.switchV = !1, this.switchN = r && this.parser.options.ecmaVersion >= 9);
      }, K.prototype.raise = function(t) {
        this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + t);
      }, K.prototype.at = function(t, e) {
        e === void 0 && (e = !1);
        var s = this.source, i = s.length;
        if (t >= i) return -1;
        var r = s.charCodeAt(t);
        if (!e && !this.switchU || r <= 55295 || r >= 57344 || t + 1 >= i) return r;
        var a = s.charCodeAt(t + 1);
        return a >= 56320 && a <= 57343 ? (r << 10) + a - 56613888 : r;
      }, K.prototype.nextIndex = function(t, e) {
        e === void 0 && (e = !1);
        var s = this.source, i = s.length;
        if (t >= i) return i;
        var r, a = s.charCodeAt(t);
        return !e && !this.switchU || a <= 55295 || a >= 57344 || t + 1 >= i || (r = s.charCodeAt(t + 1)) < 56320 || r > 57343 ? t + 1 : t + 2;
      }, K.prototype.current = function(t) {
        return t === void 0 && (t = !1), this.at(this.pos, t);
      }, K.prototype.lookahead = function(t) {
        return t === void 0 && (t = !1), this.at(this.nextIndex(this.pos, t), t);
      }, K.prototype.advance = function(t) {
        t === void 0 && (t = !1), this.pos = this.nextIndex(this.pos, t);
      }, K.prototype.eat = function(t, e) {
        return e === void 0 && (e = !1), this.current(e) === t && (this.advance(e), !0);
      }, K.prototype.eatChars = function(t, e) {
        e === void 0 && (e = !1);
        for (var s = this.pos, i = 0, r = t; i < r.length; i += 1) {
          var a = r[i], o = this.at(s, e);
          if (o === -1 || o !== a) return !1;
          s = this.nextIndex(s, e);
        }
        return this.pos = s, !0;
      }, d.validateRegExpFlags = function(t) {
        for (var e = t.validFlags, s = t.flags, i = !1, r = !1, a = 0; a < s.length; a++) {
          var o = s.charAt(a);
          e.indexOf(o) === -1 && this.raise(t.start, "Invalid regular expression flag"), s.indexOf(o, a + 1) > -1 && this.raise(t.start, "Duplicate regular expression flag"), o === "u" && (i = !0), o === "v" && (r = !0);
        }
        this.options.ecmaVersion >= 15 && i && r && this.raise(t.start, "Invalid regular expression flag");
      }, d.validateRegExpPattern = function(t) {
        this.regexp_pattern(t), !t.switchN && this.options.ecmaVersion >= 9 && (function(e) {
          for (var s in e) return !0;
          return !1;
        })(t.groupNames) && (t.switchN = !0, this.regexp_pattern(t));
      }, d.regexp_pattern = function(t) {
        t.pos = 0, t.lastIntValue = 0, t.lastStringValue = "", t.lastAssertionIsQuantifiable = !1, t.numCapturingParens = 0, t.maxBackReference = 0, t.groupNames = /* @__PURE__ */ Object.create(null), t.backReferenceNames.length = 0, t.branchID = null, this.regexp_disjunction(t), t.pos !== t.source.length && (t.eat(41) && t.raise("Unmatched ')'"), (t.eat(93) || t.eat(125)) && t.raise("Lone quantifier brackets")), t.maxBackReference > t.numCapturingParens && t.raise("Invalid escape");
        for (var e = 0, s = t.backReferenceNames; e < s.length; e += 1) {
          var i = s[e];
          t.groupNames[i] || t.raise("Invalid named capture referenced");
        }
      }, d.regexp_disjunction = function(t) {
        var e = this.options.ecmaVersion >= 16;
        for (e && (t.branchID = new Dt(t.branchID, null)), this.regexp_alternative(t); t.eat(124); ) e && (t.branchID = t.branchID.sibling()), this.regexp_alternative(t);
        e && (t.branchID = t.branchID.parent), this.regexp_eatQuantifier(t, !0) && t.raise("Nothing to repeat"), t.eat(123) && t.raise("Lone quantifier brackets");
      }, d.regexp_alternative = function(t) {
        for (; t.pos < t.source.length && this.regexp_eatTerm(t); ) ;
      }, d.regexp_eatTerm = function(t) {
        return this.regexp_eatAssertion(t) ? (t.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(t) && t.switchU && t.raise("Invalid quantifier"), !0) : !!(t.switchU ? this.regexp_eatAtom(t) : this.regexp_eatExtendedAtom(t)) && (this.regexp_eatQuantifier(t), !0);
      }, d.regexp_eatAssertion = function(t) {
        var e = t.pos;
        if (t.lastAssertionIsQuantifiable = !1, t.eat(94) || t.eat(36)) return !0;
        if (t.eat(92)) {
          if (t.eat(66) || t.eat(98)) return !0;
          t.pos = e;
        }
        if (t.eat(40) && t.eat(63)) {
          var s = !1;
          if (this.options.ecmaVersion >= 9 && (s = t.eat(60)), t.eat(61) || t.eat(33)) return this.regexp_disjunction(t), t.eat(41) || t.raise("Unterminated group"), t.lastAssertionIsQuantifiable = !s, !0;
        }
        return t.pos = e, !1;
      }, d.regexp_eatQuantifier = function(t, e) {
        return e === void 0 && (e = !1), !!this.regexp_eatQuantifierPrefix(t, e) && (t.eat(63), !0);
      }, d.regexp_eatQuantifierPrefix = function(t, e) {
        return t.eat(42) || t.eat(43) || t.eat(63) || this.regexp_eatBracedQuantifier(t, e);
      }, d.regexp_eatBracedQuantifier = function(t, e) {
        var s = t.pos;
        if (t.eat(123)) {
          var i = 0, r = -1;
          if (this.regexp_eatDecimalDigits(t) && (i = t.lastIntValue, t.eat(44) && this.regexp_eatDecimalDigits(t) && (r = t.lastIntValue), t.eat(125))) return r !== -1 && r < i && !e && t.raise("numbers out of order in {} quantifier"), !0;
          t.switchU && !e && t.raise("Incomplete quantifier"), t.pos = s;
        }
        return !1;
      }, d.regexp_eatAtom = function(t) {
        return this.regexp_eatPatternCharacters(t) || t.eat(46) || this.regexp_eatReverseSolidusAtomEscape(t) || this.regexp_eatCharacterClass(t) || this.regexp_eatUncapturingGroup(t) || this.regexp_eatCapturingGroup(t);
      }, d.regexp_eatReverseSolidusAtomEscape = function(t) {
        var e = t.pos;
        if (t.eat(92)) {
          if (this.regexp_eatAtomEscape(t)) return !0;
          t.pos = e;
        }
        return !1;
      }, d.regexp_eatUncapturingGroup = function(t) {
        var e = t.pos;
        if (t.eat(40)) {
          if (t.eat(63)) {
            if (this.options.ecmaVersion >= 16) {
              var s = this.regexp_eatModifiers(t), i = t.eat(45);
              if (s || i) {
                for (var r = 0; r < s.length; r++) {
                  var a = s.charAt(r);
                  s.indexOf(a, r + 1) > -1 && t.raise("Duplicate regular expression modifiers");
                }
                if (i) {
                  var o = this.regexp_eatModifiers(t);
                  s || o || t.current() !== 58 || t.raise("Invalid regular expression modifiers");
                  for (var h = 0; h < o.length; h++) {
                    var c = o.charAt(h);
                    (o.indexOf(c, h + 1) > -1 || s.indexOf(c) > -1) && t.raise("Duplicate regular expression modifiers");
                  }
                }
              }
            }
            if (t.eat(58)) {
              if (this.regexp_disjunction(t), t.eat(41)) return !0;
              t.raise("Unterminated group");
            }
          }
          t.pos = e;
        }
        return !1;
      }, d.regexp_eatCapturingGroup = function(t) {
        if (t.eat(40)) {
          if (this.options.ecmaVersion >= 9 ? this.regexp_groupSpecifier(t) : t.current() === 63 && t.raise("Invalid group"), this.regexp_disjunction(t), t.eat(41)) return t.numCapturingParens += 1, !0;
          t.raise("Unterminated group");
        }
        return !1;
      }, d.regexp_eatModifiers = function(t) {
        for (var e = "", s = 0; (s = t.current()) !== -1 && ai(s); ) e += J(s), t.advance();
        return e;
      }, d.regexp_eatExtendedAtom = function(t) {
        return t.eat(46) || this.regexp_eatReverseSolidusAtomEscape(t) || this.regexp_eatCharacterClass(t) || this.regexp_eatUncapturingGroup(t) || this.regexp_eatCapturingGroup(t) || this.regexp_eatInvalidBracedQuantifier(t) || this.regexp_eatExtendedPatternCharacter(t);
      }, d.regexp_eatInvalidBracedQuantifier = function(t) {
        return this.regexp_eatBracedQuantifier(t, !0) && t.raise("Nothing to repeat"), !1;
      }, d.regexp_eatSyntaxCharacter = function(t) {
        var e = t.current();
        return !!$e(e) && (t.lastIntValue = e, t.advance(), !0);
      }, d.regexp_eatPatternCharacters = function(t) {
        for (var e = t.pos, s = 0; (s = t.current()) !== -1 && !$e(s); ) t.advance();
        return t.pos !== e;
      }, d.regexp_eatExtendedPatternCharacter = function(t) {
        var e = t.current();
        return !(e === -1 || e === 36 || e >= 40 && e <= 43 || e === 46 || e === 63 || e === 91 || e === 94 || e === 124) && (t.advance(), !0);
      }, d.regexp_groupSpecifier = function(t) {
        if (t.eat(63)) {
          this.regexp_eatGroupName(t) || t.raise("Invalid group");
          var e = this.options.ecmaVersion >= 16, s = t.groupNames[t.lastStringValue];
          if (s) if (e) for (var i = 0, r = s; i < r.length; i += 1)
            r[i].separatedFrom(t.branchID) || t.raise("Duplicate capture group name");
          else t.raise("Duplicate capture group name");
          e ? (s || (t.groupNames[t.lastStringValue] = [])).push(t.branchID) : t.groupNames[t.lastStringValue] = !0;
        }
      }, d.regexp_eatGroupName = function(t) {
        if (t.lastStringValue = "", t.eat(60)) {
          if (this.regexp_eatRegExpIdentifierName(t) && t.eat(62)) return !0;
          t.raise("Invalid capture group name");
        }
        return !1;
      }, d.regexp_eatRegExpIdentifierName = function(t) {
        if (t.lastStringValue = "", this.regexp_eatRegExpIdentifierStart(t)) {
          for (t.lastStringValue += J(t.lastIntValue); this.regexp_eatRegExpIdentifierPart(t); ) t.lastStringValue += J(t.lastIntValue);
          return !0;
        }
        return !1;
      }, d.regexp_eatRegExpIdentifierStart = function(t) {
        var e = t.pos, s = this.options.ecmaVersion >= 11, i = t.current(s);
        return t.advance(s), i === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(t, s) && (i = t.lastIntValue), (function(r) {
          return G(r, !0) || r === 36 || r === 95;
        })(i) ? (t.lastIntValue = i, !0) : (t.pos = e, !1);
      }, d.regexp_eatRegExpIdentifierPart = function(t) {
        var e = t.pos, s = this.options.ecmaVersion >= 11, i = t.current(s);
        return t.advance(s), i === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(t, s) && (i = t.lastIntValue), (function(r) {
          return Q(r, !0) || r === 36 || r === 95 || r === 8204 || r === 8205;
        })(i) ? (t.lastIntValue = i, !0) : (t.pos = e, !1);
      }, d.regexp_eatAtomEscape = function(t) {
        return !!(this.regexp_eatBackReference(t) || this.regexp_eatCharacterClassEscape(t) || this.regexp_eatCharacterEscape(t) || t.switchN && this.regexp_eatKGroupName(t)) || (t.switchU && (t.current() === 99 && t.raise("Invalid unicode escape"), t.raise("Invalid escape")), !1);
      }, d.regexp_eatBackReference = function(t) {
        var e = t.pos;
        if (this.regexp_eatDecimalEscape(t)) {
          var s = t.lastIntValue;
          if (t.switchU) return s > t.maxBackReference && (t.maxBackReference = s), !0;
          if (s <= t.numCapturingParens) return !0;
          t.pos = e;
        }
        return !1;
      }, d.regexp_eatKGroupName = function(t) {
        if (t.eat(107)) {
          if (this.regexp_eatGroupName(t)) return t.backReferenceNames.push(t.lastStringValue), !0;
          t.raise("Invalid named reference");
        }
        return !1;
      }, d.regexp_eatCharacterEscape = function(t) {
        return this.regexp_eatControlEscape(t) || this.regexp_eatCControlLetter(t) || this.regexp_eatZero(t) || this.regexp_eatHexEscapeSequence(t) || this.regexp_eatRegExpUnicodeEscapeSequence(t, !1) || !t.switchU && this.regexp_eatLegacyOctalEscapeSequence(t) || this.regexp_eatIdentityEscape(t);
      }, d.regexp_eatCControlLetter = function(t) {
        var e = t.pos;
        if (t.eat(99)) {
          if (this.regexp_eatControlLetter(t)) return !0;
          t.pos = e;
        }
        return !1;
      }, d.regexp_eatZero = function(t) {
        return t.current() === 48 && !Vt(t.lookahead()) && (t.lastIntValue = 0, t.advance(), !0);
      }, d.regexp_eatControlEscape = function(t) {
        var e = t.current();
        return e === 116 ? (t.lastIntValue = 9, t.advance(), !0) : e === 110 ? (t.lastIntValue = 10, t.advance(), !0) : e === 118 ? (t.lastIntValue = 11, t.advance(), !0) : e === 102 ? (t.lastIntValue = 12, t.advance(), !0) : e === 114 && (t.lastIntValue = 13, t.advance(), !0);
      }, d.regexp_eatControlLetter = function(t) {
        var e = t.current();
        return !!qe(e) && (t.lastIntValue = e % 32, t.advance(), !0);
      }, d.regexp_eatRegExpUnicodeEscapeSequence = function(t, e) {
        e === void 0 && (e = !1);
        var s, i = t.pos, r = e || t.switchU;
        if (t.eat(117)) {
          if (this.regexp_eatFixedHexDigits(t, 4)) {
            var a = t.lastIntValue;
            if (r && a >= 55296 && a <= 56319) {
              var o = t.pos;
              if (t.eat(92) && t.eat(117) && this.regexp_eatFixedHexDigits(t, 4)) {
                var h = t.lastIntValue;
                if (h >= 56320 && h <= 57343) return t.lastIntValue = 1024 * (a - 55296) + (h - 56320) + 65536, !0;
              }
              t.pos = o, t.lastIntValue = a;
            }
            return !0;
          }
          if (r && t.eat(123) && this.regexp_eatHexDigits(t) && t.eat(125) && (s = t.lastIntValue) >= 0 && s <= 1114111) return !0;
          r && t.raise("Invalid unicode escape"), t.pos = i;
        }
        return !1;
      }, d.regexp_eatIdentityEscape = function(t) {
        if (t.switchU) return !!this.regexp_eatSyntaxCharacter(t) || !!t.eat(47) && (t.lastIntValue = 47, !0);
        var e = t.current();
        return !(e === 99 || t.switchN && e === 107) && (t.lastIntValue = e, t.advance(), !0);
      }, d.regexp_eatDecimalEscape = function(t) {
        t.lastIntValue = 0;
        var e = t.current();
        if (e >= 49 && e <= 57) {
          do
            t.lastIntValue = 10 * t.lastIntValue + (e - 48), t.advance();
          while ((e = t.current()) >= 48 && e <= 57);
          return !0;
        }
        return !1;
      };
      function We(t) {
        return qe(t) || t === 95;
      }
      function oi(t) {
        return We(t) || Vt(t);
      }
      function Vt(t) {
        return t >= 48 && t <= 57;
      }
      function Ge(t) {
        return t >= 48 && t <= 57 || t >= 65 && t <= 70 || t >= 97 && t <= 102;
      }
      function He(t) {
        return t >= 65 && t <= 70 ? t - 65 + 10 : t >= 97 && t <= 102 ? t - 97 + 10 : t - 48;
      }
      function Ke(t) {
        return t >= 48 && t <= 55;
      }
      d.regexp_eatCharacterClassEscape = function(t) {
        var e = t.current();
        if (/* @__PURE__ */ (function(r) {
          return r === 100 || r === 68 || r === 115 || r === 83 || r === 119 || r === 87;
        })(e)) return t.lastIntValue = -1, t.advance(), 1;
        var s = !1;
        if (t.switchU && this.options.ecmaVersion >= 9 && ((s = e === 80) || e === 112)) {
          var i;
          if (t.lastIntValue = -1, t.advance(), t.eat(123) && (i = this.regexp_eatUnicodePropertyValueExpression(t)) && t.eat(125)) return s && i === 2 && t.raise("Invalid property name"), i;
          t.raise("Invalid property name");
        }
        return 0;
      }, d.regexp_eatUnicodePropertyValueExpression = function(t) {
        var e = t.pos;
        if (this.regexp_eatUnicodePropertyName(t) && t.eat(61)) {
          var s = t.lastStringValue;
          if (this.regexp_eatUnicodePropertyValue(t)) {
            var i = t.lastStringValue;
            return this.regexp_validateUnicodePropertyNameAndValue(t, s, i), 1;
          }
        }
        if (t.pos = e, this.regexp_eatLoneUnicodePropertyNameOrValue(t)) {
          var r = t.lastStringValue;
          return this.regexp_validateUnicodePropertyNameOrValue(t, r);
        }
        return 0;
      }, d.regexp_validateUnicodePropertyNameAndValue = function(t, e, s) {
        pt(t.unicodeProperties.nonBinary, e) || t.raise("Invalid property name"), t.unicodeProperties.nonBinary[e].test(s) || t.raise("Invalid property value");
      }, d.regexp_validateUnicodePropertyNameOrValue = function(t, e) {
        return t.unicodeProperties.binary.test(e) ? 1 : t.switchV && t.unicodeProperties.binaryOfStrings.test(e) ? 2 : void t.raise("Invalid property name");
      }, d.regexp_eatUnicodePropertyName = function(t) {
        var e = 0;
        for (t.lastStringValue = ""; We(e = t.current()); ) t.lastStringValue += J(e), t.advance();
        return t.lastStringValue !== "";
      }, d.regexp_eatUnicodePropertyValue = function(t) {
        var e = 0;
        for (t.lastStringValue = ""; oi(e = t.current()); ) t.lastStringValue += J(e), t.advance();
        return t.lastStringValue !== "";
      }, d.regexp_eatLoneUnicodePropertyNameOrValue = function(t) {
        return this.regexp_eatUnicodePropertyValue(t);
      }, d.regexp_eatCharacterClass = function(t) {
        if (t.eat(91)) {
          var e = t.eat(94), s = this.regexp_classContents(t);
          return t.eat(93) || t.raise("Unterminated character class"), e && s === 2 && t.raise("Negated character class may contain strings"), !0;
        }
        return !1;
      }, d.regexp_classContents = function(t) {
        return t.current() === 93 ? 1 : t.switchV ? this.regexp_classSetExpression(t) : (this.regexp_nonEmptyClassRanges(t), 1);
      }, d.regexp_nonEmptyClassRanges = function(t) {
        for (; this.regexp_eatClassAtom(t); ) {
          var e = t.lastIntValue;
          if (t.eat(45) && this.regexp_eatClassAtom(t)) {
            var s = t.lastIntValue;
            !t.switchU || e !== -1 && s !== -1 || t.raise("Invalid character class"), e !== -1 && s !== -1 && e > s && t.raise("Range out of order in character class");
          }
        }
      }, d.regexp_eatClassAtom = function(t) {
        var e = t.pos;
        if (t.eat(92)) {
          if (this.regexp_eatClassEscape(t)) return !0;
          if (t.switchU) {
            var s = t.current();
            (s === 99 || Ke(s)) && t.raise("Invalid class escape"), t.raise("Invalid escape");
          }
          t.pos = e;
        }
        var i = t.current();
        return i !== 93 && (t.lastIntValue = i, t.advance(), !0);
      }, d.regexp_eatClassEscape = function(t) {
        var e = t.pos;
        if (t.eat(98)) return t.lastIntValue = 8, !0;
        if (t.switchU && t.eat(45)) return t.lastIntValue = 45, !0;
        if (!t.switchU && t.eat(99)) {
          if (this.regexp_eatClassControlLetter(t)) return !0;
          t.pos = e;
        }
        return this.regexp_eatCharacterClassEscape(t) || this.regexp_eatCharacterEscape(t);
      }, d.regexp_classSetExpression = function(t) {
        var e, s = 1;
        if (!this.regexp_eatClassSetRange(t)) if (e = this.regexp_eatClassSetOperand(t)) {
          e === 2 && (s = 2);
          for (var i = t.pos; t.eatChars([38, 38]); ) t.current() !== 38 && (e = this.regexp_eatClassSetOperand(t)) ? e !== 2 && (s = 1) : t.raise("Invalid character in character class");
          if (i !== t.pos) return s;
          for (; t.eatChars([45, 45]); ) this.regexp_eatClassSetOperand(t) || t.raise("Invalid character in character class");
          if (i !== t.pos) return s;
        } else t.raise("Invalid character in character class");
        for (; ; ) if (!this.regexp_eatClassSetRange(t)) {
          if (!(e = this.regexp_eatClassSetOperand(t))) return s;
          e === 2 && (s = 2);
        }
      }, d.regexp_eatClassSetRange = function(t) {
        var e = t.pos;
        if (this.regexp_eatClassSetCharacter(t)) {
          var s = t.lastIntValue;
          if (t.eat(45) && this.regexp_eatClassSetCharacter(t)) {
            var i = t.lastIntValue;
            return s !== -1 && i !== -1 && s > i && t.raise("Range out of order in character class"), !0;
          }
          t.pos = e;
        }
        return !1;
      }, d.regexp_eatClassSetOperand = function(t) {
        return this.regexp_eatClassSetCharacter(t) ? 1 : this.regexp_eatClassStringDisjunction(t) || this.regexp_eatNestedClass(t);
      }, d.regexp_eatNestedClass = function(t) {
        var e = t.pos;
        if (t.eat(91)) {
          var s = t.eat(94), i = this.regexp_classContents(t);
          if (t.eat(93)) return s && i === 2 && t.raise("Negated character class may contain strings"), i;
          t.pos = e;
        }
        if (t.eat(92)) {
          var r = this.regexp_eatCharacterClassEscape(t);
          if (r) return r;
          t.pos = e;
        }
        return null;
      }, d.regexp_eatClassStringDisjunction = function(t) {
        var e = t.pos;
        if (t.eatChars([92, 113])) {
          if (t.eat(123)) {
            var s = this.regexp_classStringDisjunctionContents(t);
            if (t.eat(125)) return s;
          } else t.raise("Invalid escape");
          t.pos = e;
        }
        return null;
      }, d.regexp_classStringDisjunctionContents = function(t) {
        for (var e = this.regexp_classString(t); t.eat(124); ) this.regexp_classString(t) === 2 && (e = 2);
        return e;
      }, d.regexp_classString = function(t) {
        for (var e = 0; this.regexp_eatClassSetCharacter(t); ) e++;
        return e === 1 ? 1 : 2;
      }, d.regexp_eatClassSetCharacter = function(t) {
        var e = t.pos;
        if (t.eat(92)) return !(!this.regexp_eatCharacterEscape(t) && !this.regexp_eatClassSetReservedPunctuator(t)) || (t.eat(98) ? (t.lastIntValue = 8, !0) : (t.pos = e, !1));
        var s = t.current();
        return !(s < 0 || s === t.lookahead() && (function(i) {
          return i === 33 || i >= 35 && i <= 38 || i >= 42 && i <= 44 || i === 46 || i >= 58 && i <= 64 || i === 94 || i === 96 || i === 126;
        })(s)) && !(function(i) {
          return i === 40 || i === 41 || i === 45 || i === 47 || i >= 91 && i <= 93 || i >= 123 && i <= 125;
        })(s) && (t.advance(), t.lastIntValue = s, !0);
      }, d.regexp_eatClassSetReservedPunctuator = function(t) {
        var e = t.current();
        return !!(function(s) {
          return s === 33 || s === 35 || s === 37 || s === 38 || s === 44 || s === 45 || s >= 58 && s <= 62 || s === 64 || s === 96 || s === 126;
        })(e) && (t.lastIntValue = e, t.advance(), !0);
      }, d.regexp_eatClassControlLetter = function(t) {
        var e = t.current();
        return !(!Vt(e) && e !== 95) && (t.lastIntValue = e % 32, t.advance(), !0);
      }, d.regexp_eatHexEscapeSequence = function(t) {
        var e = t.pos;
        if (t.eat(120)) {
          if (this.regexp_eatFixedHexDigits(t, 2)) return !0;
          t.switchU && t.raise("Invalid escape"), t.pos = e;
        }
        return !1;
      }, d.regexp_eatDecimalDigits = function(t) {
        var e = t.pos, s = 0;
        for (t.lastIntValue = 0; Vt(s = t.current()); ) t.lastIntValue = 10 * t.lastIntValue + (s - 48), t.advance();
        return t.pos !== e;
      }, d.regexp_eatHexDigits = function(t) {
        var e = t.pos, s = 0;
        for (t.lastIntValue = 0; Ge(s = t.current()); ) t.lastIntValue = 16 * t.lastIntValue + He(s), t.advance();
        return t.pos !== e;
      }, d.regexp_eatLegacyOctalEscapeSequence = function(t) {
        if (this.regexp_eatOctalDigit(t)) {
          var e = t.lastIntValue;
          if (this.regexp_eatOctalDigit(t)) {
            var s = t.lastIntValue;
            e <= 3 && this.regexp_eatOctalDigit(t) ? t.lastIntValue = 64 * e + 8 * s + t.lastIntValue : t.lastIntValue = 8 * e + s;
          } else t.lastIntValue = e;
          return !0;
        }
        return !1;
      }, d.regexp_eatOctalDigit = function(t) {
        var e = t.current();
        return Ke(e) ? (t.lastIntValue = e - 48, t.advance(), !0) : (t.lastIntValue = 0, !1);
      }, d.regexp_eatFixedHexDigits = function(t, e) {
        var s = t.pos;
        t.lastIntValue = 0;
        for (var i = 0; i < e; ++i) {
          var r = t.current();
          if (!Ge(r)) return t.pos = s, !1;
          t.lastIntValue = 16 * t.lastIntValue + He(r), t.advance();
        }
        return !0;
      };
      var ie = function(t) {
        this.type = t.type, this.value = t.value, this.start = t.start, this.end = t.end, t.options.locations && (this.loc = new Tt(t, t.startLoc, t.endLoc)), t.options.ranges && (this.range = [t.start, t.end]);
      }, _ = P.prototype;
      function ze(t) {
        return typeof BigInt != "function" ? null : BigInt(t.replace(/_/g, ""));
      }
      _.next = function(t) {
        !t && this.type.keyword && this.containsEsc && this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword), this.options.onToken && this.options.onToken(new ie(this)), this.lastTokEnd = this.end, this.lastTokStart = this.start, this.lastTokEndLoc = this.endLoc, this.lastTokStartLoc = this.startLoc, this.nextToken();
      }, _.getToken = function() {
        return this.next(), new ie(this);
      }, typeof Symbol < "u" && (_[Symbol.iterator] = function() {
        var t = this;
        return { next: function() {
          var e = t.getToken();
          return { done: e.type === n.eof, value: e };
        } };
      }), _.nextToken = function() {
        var t = this.curContext();
        return t && t.preserveSpace || this.skipSpace(), this.start = this.pos, this.options.locations && (this.startLoc = this.curPosition()), this.pos >= this.input.length ? this.finishToken(n.eof) : t.override ? t.override(this) : void this.readToken(this.fullCharCodeAtPos());
      }, _.readToken = function(t) {
        return G(t, this.options.ecmaVersion >= 6) || t === 92 ? this.readWord() : this.getTokenFromCode(t);
      }, _.fullCharCodeAtPos = function() {
        var t = this.input.charCodeAt(this.pos);
        if (t <= 55295 || t >= 56320) return t;
        var e = this.input.charCodeAt(this.pos + 1);
        return e <= 56319 || e >= 57344 ? t : (t << 10) + e - 56613888;
      }, _.skipBlockComment = function() {
        var t = this.options.onComment && this.curPosition(), e = this.pos, s = this.input.indexOf("*/", this.pos += 2);
        if (s === -1 && this.raise(this.pos - 2, "Unterminated comment"), this.pos = s + 2, this.options.locations) for (var i = void 0, r = e; (i = Se(this.input, r, this.pos)) > -1; ) ++this.curLine, r = this.lineStart = i;
        this.options.onComment && this.options.onComment(!0, this.input.slice(e + 2, s), e, this.pos, t, this.curPosition());
      }, _.skipLineComment = function(t) {
        for (var e = this.pos, s = this.options.onComment && this.curPosition(), i = this.input.charCodeAt(this.pos += t); this.pos < this.input.length && !lt(i); ) i = this.input.charCodeAt(++this.pos);
        this.options.onComment && this.options.onComment(!1, this.input.slice(e + t, this.pos), e, this.pos, s, this.curPosition());
      }, _.skipSpace = function() {
        t: for (; this.pos < this.input.length; ) {
          var t = this.input.charCodeAt(this.pos);
          switch (t) {
            case 32:
            case 160:
              ++this.pos;
              break;
            case 13:
              this.input.charCodeAt(this.pos + 1) === 10 && ++this.pos;
            case 10:
            case 8232:
            case 8233:
              ++this.pos, this.options.locations && (++this.curLine, this.lineStart = this.pos);
              break;
            case 47:
              switch (this.input.charCodeAt(this.pos + 1)) {
                case 42:
                  this.skipBlockComment();
                  break;
                case 47:
                  this.skipLineComment(2);
                  break;
                default:
                  break t;
              }
              break;
            default:
              if (!(t > 8 && t < 14 || t >= 5760 && Ce.test(String.fromCharCode(t)))) break t;
              ++this.pos;
          }
        }
      }, _.finishToken = function(t, e) {
        this.end = this.pos, this.options.locations && (this.endLoc = this.curPosition());
        var s = this.type;
        this.type = t, this.value = e, this.updateContext(s);
      }, _.readToken_dot = function() {
        var t = this.input.charCodeAt(this.pos + 1);
        if (t >= 48 && t <= 57) return this.readNumber(!0);
        var e = this.input.charCodeAt(this.pos + 2);
        return this.options.ecmaVersion >= 6 && t === 46 && e === 46 ? (this.pos += 3, this.finishToken(n.ellipsis)) : (++this.pos, this.finishToken(n.dot));
      }, _.readToken_slash = function() {
        var t = this.input.charCodeAt(this.pos + 1);
        return this.exprAllowed ? (++this.pos, this.readRegexp()) : t === 61 ? this.finishOp(n.assign, 2) : this.finishOp(n.slash, 1);
      }, _.readToken_mult_modulo_exp = function(t) {
        var e = this.input.charCodeAt(this.pos + 1), s = 1, i = t === 42 ? n.star : n.modulo;
        return this.options.ecmaVersion >= 7 && t === 42 && e === 42 && (++s, i = n.starstar, e = this.input.charCodeAt(this.pos + 2)), e === 61 ? this.finishOp(n.assign, s + 1) : this.finishOp(i, s);
      }, _.readToken_pipe_amp = function(t) {
        var e = this.input.charCodeAt(this.pos + 1);
        return e === t ? this.options.ecmaVersion >= 12 && this.input.charCodeAt(this.pos + 2) === 61 ? this.finishOp(n.assign, 3) : this.finishOp(t === 124 ? n.logicalOR : n.logicalAND, 2) : e === 61 ? this.finishOp(n.assign, 2) : this.finishOp(t === 124 ? n.bitwiseOR : n.bitwiseAND, 1);
      }, _.readToken_caret = function() {
        return this.input.charCodeAt(this.pos + 1) === 61 ? this.finishOp(n.assign, 2) : this.finishOp(n.bitwiseXOR, 1);
      }, _.readToken_plus_min = function(t) {
        var e = this.input.charCodeAt(this.pos + 1);
        return e === t ? e !== 45 || this.inModule || this.input.charCodeAt(this.pos + 2) !== 62 || this.lastTokEnd !== 0 && !U.test(this.input.slice(this.lastTokEnd, this.pos)) ? this.finishOp(n.incDec, 2) : (this.skipLineComment(3), this.skipSpace(), this.nextToken()) : e === 61 ? this.finishOp(n.assign, 2) : this.finishOp(n.plusMin, 1);
      }, _.readToken_lt_gt = function(t) {
        var e = this.input.charCodeAt(this.pos + 1), s = 1;
        return e === t ? (s = t === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2, this.input.charCodeAt(this.pos + s) === 61 ? this.finishOp(n.assign, s + 1) : this.finishOp(n.bitShift, s)) : e !== 33 || t !== 60 || this.inModule || this.input.charCodeAt(this.pos + 2) !== 45 || this.input.charCodeAt(this.pos + 3) !== 45 ? (e === 61 && (s = 2), this.finishOp(n.relational, s)) : (this.skipLineComment(4), this.skipSpace(), this.nextToken());
      }, _.readToken_eq_excl = function(t) {
        var e = this.input.charCodeAt(this.pos + 1);
        return e === 61 ? this.finishOp(n.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2) : t === 61 && e === 62 && this.options.ecmaVersion >= 6 ? (this.pos += 2, this.finishToken(n.arrow)) : this.finishOp(t === 61 ? n.eq : n.prefix, 1);
      }, _.readToken_question = function() {
        var t = this.options.ecmaVersion;
        if (t >= 11) {
          var e = this.input.charCodeAt(this.pos + 1);
          if (e === 46) {
            var s = this.input.charCodeAt(this.pos + 2);
            if (s < 48 || s > 57) return this.finishOp(n.questionDot, 2);
          }
          if (e === 63)
            return t >= 12 && this.input.charCodeAt(this.pos + 2) === 61 ? this.finishOp(n.assign, 3) : this.finishOp(n.coalesce, 2);
        }
        return this.finishOp(n.question, 1);
      }, _.readToken_numberSign = function() {
        var t = 35;
        if (this.options.ecmaVersion >= 13 && (++this.pos, G(t = this.fullCharCodeAtPos(), !0) || t === 92)) return this.finishToken(n.privateId, this.readWord1());
        this.raise(this.pos, "Unexpected character '" + J(t) + "'");
      }, _.getTokenFromCode = function(t) {
        switch (t) {
          case 46:
            return this.readToken_dot();
          case 40:
            return ++this.pos, this.finishToken(n.parenL);
          case 41:
            return ++this.pos, this.finishToken(n.parenR);
          case 59:
            return ++this.pos, this.finishToken(n.semi);
          case 44:
            return ++this.pos, this.finishToken(n.comma);
          case 91:
            return ++this.pos, this.finishToken(n.bracketL);
          case 93:
            return ++this.pos, this.finishToken(n.bracketR);
          case 123:
            return ++this.pos, this.finishToken(n.braceL);
          case 125:
            return ++this.pos, this.finishToken(n.braceR);
          case 58:
            return ++this.pos, this.finishToken(n.colon);
          case 96:
            if (this.options.ecmaVersion < 6) break;
            return ++this.pos, this.finishToken(n.backQuote);
          case 48:
            var e = this.input.charCodeAt(this.pos + 1);
            if (e === 120 || e === 88) return this.readRadixNumber(16);
            if (this.options.ecmaVersion >= 6) {
              if (e === 111 || e === 79) return this.readRadixNumber(8);
              if (e === 98 || e === 66) return this.readRadixNumber(2);
            }
          case 49:
          case 50:
          case 51:
          case 52:
          case 53:
          case 54:
          case 55:
          case 56:
          case 57:
            return this.readNumber(!1);
          case 34:
          case 39:
            return this.readString(t);
          case 47:
            return this.readToken_slash();
          case 37:
          case 42:
            return this.readToken_mult_modulo_exp(t);
          case 124:
          case 38:
            return this.readToken_pipe_amp(t);
          case 94:
            return this.readToken_caret();
          case 43:
          case 45:
            return this.readToken_plus_min(t);
          case 60:
          case 62:
            return this.readToken_lt_gt(t);
          case 61:
          case 33:
            return this.readToken_eq_excl(t);
          case 63:
            return this.readToken_question();
          case 126:
            return this.finishOp(n.prefix, 1);
          case 35:
            return this.readToken_numberSign();
        }
        this.raise(this.pos, "Unexpected character '" + J(t) + "'");
      }, _.finishOp = function(t, e) {
        var s = this.input.slice(this.pos, this.pos + e);
        return this.pos += e, this.finishToken(t, s);
      }, _.readRegexp = function() {
        for (var t, e, s = this.pos; ; ) {
          this.pos >= this.input.length && this.raise(s, "Unterminated regular expression");
          var i = this.input.charAt(this.pos);
          if (U.test(i) && this.raise(s, "Unterminated regular expression"), t) t = !1;
          else {
            if (i === "[") e = !0;
            else if (i === "]" && e) e = !1;
            else if (i === "/" && !e) break;
            t = i === "\\";
          }
          ++this.pos;
        }
        var r = this.input.slice(s, this.pos);
        ++this.pos;
        var a = this.pos, o = this.readWord1();
        this.containsEsc && this.unexpected(a);
        var h = this.regexpState || (this.regexpState = new K(this));
        h.reset(s, r, o), this.validateRegExpFlags(h), this.validateRegExpPattern(h);
        var c = null;
        try {
          c = new RegExp(r, o);
        } catch {
        }
        return this.finishToken(n.regexp, { pattern: r, flags: o, value: c });
      }, _.readInt = function(t, e, s) {
        for (var i = this.options.ecmaVersion >= 12 && e === void 0, r = s && this.input.charCodeAt(this.pos) === 48, a = this.pos, o = 0, h = 0, c = 0, p = e ?? 1 / 0; c < p; ++c, ++this.pos) {
          var l = this.input.charCodeAt(this.pos), f = void 0;
          if (i && l === 95) r && this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals"), h === 95 && this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore"), c === 0 && this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits"), h = l;
          else {
            if ((f = l >= 97 ? l - 97 + 10 : l >= 65 ? l - 65 + 10 : l >= 48 && l <= 57 ? l - 48 : 1 / 0) >= t) break;
            h = l, o = o * t + f;
          }
        }
        return i && h === 95 && this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits"), this.pos === a || e != null && this.pos - a !== e ? null : o;
      }, _.readRadixNumber = function(t) {
        var e = this.pos;
        this.pos += 2;
        var s = this.readInt(t);
        return s == null && this.raise(this.start + 2, "Expected number in radix " + t), this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110 ? (s = ze(this.input.slice(e, this.pos)), ++this.pos) : G(this.fullCharCodeAtPos()) && this.raise(this.pos, "Identifier directly after number"), this.finishToken(n.num, s);
      }, _.readNumber = function(t) {
        var e = this.pos;
        t || this.readInt(10, void 0, !0) !== null || this.raise(e, "Invalid number");
        var s = this.pos - e >= 2 && this.input.charCodeAt(e) === 48;
        s && this.strict && this.raise(e, "Invalid number");
        var i = this.input.charCodeAt(this.pos);
        if (!s && !t && this.options.ecmaVersion >= 11 && i === 110) {
          var r = ze(this.input.slice(e, this.pos));
          return ++this.pos, G(this.fullCharCodeAtPos()) && this.raise(this.pos, "Identifier directly after number"), this.finishToken(n.num, r);
        }
        s && /[89]/.test(this.input.slice(e, this.pos)) && (s = !1), i !== 46 || s || (++this.pos, this.readInt(10), i = this.input.charCodeAt(this.pos)), i !== 69 && i !== 101 || s || ((i = this.input.charCodeAt(++this.pos)) !== 43 && i !== 45 || ++this.pos, this.readInt(10) === null && this.raise(e, "Invalid number")), G(this.fullCharCodeAtPos()) && this.raise(this.pos, "Identifier directly after number");
        var a, o = (a = this.input.slice(e, this.pos), s ? parseInt(a, 8) : parseFloat(a.replace(/_/g, "")));
        return this.finishToken(n.num, o);
      }, _.readCodePoint = function() {
        var t;
        if (this.input.charCodeAt(this.pos) === 123) {
          this.options.ecmaVersion < 6 && this.unexpected();
          var e = ++this.pos;
          t = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos), ++this.pos, t > 1114111 && this.invalidStringToken(e, "Code point out of bounds");
        } else t = this.readHexChar(4);
        return t;
      }, _.readString = function(t) {
        for (var e = "", s = ++this.pos; ; ) {
          this.pos >= this.input.length && this.raise(this.start, "Unterminated string constant");
          var i = this.input.charCodeAt(this.pos);
          if (i === t) break;
          i === 92 ? (e += this.input.slice(s, this.pos), e += this.readEscapedChar(!1), s = this.pos) : i === 8232 || i === 8233 ? (this.options.ecmaVersion < 10 && this.raise(this.start, "Unterminated string constant"), ++this.pos, this.options.locations && (this.curLine++, this.lineStart = this.pos)) : (lt(i) && this.raise(this.start, "Unterminated string constant"), ++this.pos);
        }
        return e += this.input.slice(s, this.pos++), this.finishToken(n.string, e);
      };
      var Je = {};
      _.tryReadTemplateToken = function() {
        this.inTemplateElement = !0;
        try {
          this.readTmplToken();
        } catch (t) {
          if (t !== Je) throw t;
          this.readInvalidTemplateToken();
        }
        this.inTemplateElement = !1;
      }, _.invalidStringToken = function(t, e) {
        if (this.inTemplateElement && this.options.ecmaVersion >= 9) throw Je;
        this.raise(t, e);
      }, _.readTmplToken = function() {
        for (var t = "", e = this.pos; ; ) {
          this.pos >= this.input.length && this.raise(this.start, "Unterminated template");
          var s = this.input.charCodeAt(this.pos);
          if (s === 96 || s === 36 && this.input.charCodeAt(this.pos + 1) === 123) return this.pos !== this.start || this.type !== n.template && this.type !== n.invalidTemplate ? (t += this.input.slice(e, this.pos), this.finishToken(n.template, t)) : s === 36 ? (this.pos += 2, this.finishToken(n.dollarBraceL)) : (++this.pos, this.finishToken(n.backQuote));
          if (s === 92) t += this.input.slice(e, this.pos), t += this.readEscapedChar(!0), e = this.pos;
          else if (lt(s)) {
            switch (t += this.input.slice(e, this.pos), ++this.pos, s) {
              case 13:
                this.input.charCodeAt(this.pos) === 10 && ++this.pos;
              case 10:
                t += `
`;
                break;
              default:
                t += String.fromCharCode(s);
            }
            this.options.locations && (++this.curLine, this.lineStart = this.pos), e = this.pos;
          } else ++this.pos;
        }
      }, _.readInvalidTemplateToken = function() {
        for (; this.pos < this.input.length; this.pos++) switch (this.input[this.pos]) {
          case "\\":
            ++this.pos;
            break;
          case "$":
            if (this.input[this.pos + 1] !== "{") break;
          case "`":
            return this.finishToken(n.invalidTemplate, this.input.slice(this.start, this.pos));
          case "\r":
            this.input[this.pos + 1] === `
` && ++this.pos;
          case `
`:
          case "\u2028":
          case "\u2029":
            ++this.curLine, this.lineStart = this.pos + 1;
        }
        this.raise(this.start, "Unterminated template");
      }, _.readEscapedChar = function(t) {
        var e = this.input.charCodeAt(++this.pos);
        switch (++this.pos, e) {
          case 110:
            return `
`;
          case 114:
            return "\r";
          case 120:
            return String.fromCharCode(this.readHexChar(2));
          case 117:
            return J(this.readCodePoint());
          case 116:
            return "	";
          case 98:
            return "\b";
          case 118:
            return "\v";
          case 102:
            return "\f";
          case 13:
            this.input.charCodeAt(this.pos) === 10 && ++this.pos;
          case 10:
            return this.options.locations && (this.lineStart = this.pos, ++this.curLine), "";
          case 56:
          case 57:
            if (this.strict && this.invalidStringToken(this.pos - 1, "Invalid escape sequence"), t) {
              var s = this.pos - 1;
              this.invalidStringToken(s, "Invalid escape sequence in template string");
            }
          default:
            if (e >= 48 && e <= 55) {
              var i = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0], r = parseInt(i, 8);
              return r > 255 && (i = i.slice(0, -1), r = parseInt(i, 8)), this.pos += i.length - 1, e = this.input.charCodeAt(this.pos), i === "0" && e !== 56 && e !== 57 || !this.strict && !t || this.invalidStringToken(this.pos - 1 - i.length, t ? "Octal literal in template string" : "Octal literal in strict mode"), String.fromCharCode(r);
            }
            return lt(e) ? (this.options.locations && (this.lineStart = this.pos, ++this.curLine), "") : String.fromCharCode(e);
        }
      }, _.readHexChar = function(t) {
        var e = this.pos, s = this.readInt(16, t);
        return s === null && this.invalidStringToken(e, "Bad character escape sequence"), s;
      }, _.readWord1 = function() {
        this.containsEsc = !1;
        for (var t = "", e = !0, s = this.pos, i = this.options.ecmaVersion >= 6; this.pos < this.input.length; ) {
          var r = this.fullCharCodeAtPos();
          if (Q(r, i)) this.pos += r <= 65535 ? 1 : 2;
          else {
            if (r !== 92) break;
            this.containsEsc = !0, t += this.input.slice(s, this.pos);
            var a = this.pos;
            this.input.charCodeAt(++this.pos) !== 117 && this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX"), ++this.pos;
            var o = this.readCodePoint();
            (e ? G : Q)(o, i) || this.invalidStringToken(a, "Invalid Unicode escape"), t += J(o), s = this.pos;
          }
          e = !1;
        }
        return t + this.input.slice(s, this.pos);
      }, _.readWord = function() {
        var t = this.readWord1(), e = n.name;
        return this.keywords.test(t) && (e = zt[t]), this.finishToken(e, t);
      }, P.acorn = { Parser: P, version: "8.15.0", defaultOptions: Jt, Position: bt, SourceLocation: Tt, getLineInfo: Re, Node: Ot, TokenType: b, tokTypes: n, keywordTypes: zt, TokContext: q, tokContexts: w, isIdentifierChar: Q, isIdentifierStart: G, Token: ie, isNewLine: lt, lineBreak: U, lineBreakG: Ws, nonASCIIwhitespace: Ce };
      const ft = _r, O = Sr, hi = /^\.?\//;
      function ci(t = "", e) {
        return t.endsWith("/") ? t : t + "/";
      }
      function li(t) {
        return t && t !== "/";
      }
      function Ye(t, ...e) {
        let s = t || "";
        for (const i of e.filter((r) => li(r))) if (s) {
          const r = i.replace(hi, "");
          s = ci(s) + r;
        } else s = i;
        return s;
      }
      const pi = /^[A-Za-z]:\//;
      function dt(t = "") {
        return t && t.replace(/\\/g, "/").replace(pi, (e) => e.toUpperCase());
      }
      const ui = /^[/\\]{2}/, fi = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/, Qe = /^[A-Za-z]:$/, di = /.(\.[^./]+|\.)$/, mi = function(t) {
        if (t.length === 0) return ".";
        const e = (t = dt(t)).match(ui), s = rt(t), i = t[t.length - 1] === "/";
        return (t = Ze(t, !s)).length === 0 ? s ? "/" : i ? "./" : "." : (i && (t += "/"), Qe.test(t) && (t += "/"), e ? s ? `//${t}` : `//./${t}` : s && !rt(t) ? `/${t}` : t);
      }, tt = function(...t) {
        let e = "";
        for (const s of t) if (s) if (e.length > 0) {
          const i = e[e.length - 1] === "/", r = s[0] === "/";
          e += i && r ? s.slice(1) : i || r ? s : `/${s}`;
        } else e += s;
        return mi(e);
      };
      function gi() {
        return typeof process < "u" && typeof process.cwd == "function" ? process.cwd().replace(/\\/g, "/") : "/";
      }
      const xi = function(...t) {
        let e = "", s = !1;
        for (let i = (t = t.map((r) => dt(r))).length - 1; i >= -1 && !s; i--) {
          const r = i >= 0 ? t[i] : gi();
          r && r.length !== 0 && (e = `${r}/${e}`, s = rt(r));
        }
        return e = Ze(e, !s), s && !rt(e) ? `/${e}` : e.length > 0 ? e : ".";
      };
      function Ze(t, e) {
        let s = "", i = 0, r = -1, a = 0, o = null;
        for (let h = 0; h <= t.length; ++h) {
          if (h < t.length) o = t[h];
          else {
            if (o === "/") break;
            o = "/";
          }
          if (o === "/") {
            if (!(r === h - 1 || a === 1)) if (a === 2) {
              if (s.length < 2 || i !== 2 || s[s.length - 1] !== "." || s[s.length - 2] !== ".") {
                if (s.length > 2) {
                  const c = s.lastIndexOf("/");
                  c === -1 ? (s = "", i = 0) : (s = s.slice(0, c), i = s.length - 1 - s.lastIndexOf("/")), r = h, a = 0;
                  continue;
                }
                if (s.length > 0) {
                  s = "", i = 0, r = h, a = 0;
                  continue;
                }
              }
              e && (s += s.length > 0 ? "/.." : "..", i = 2);
            } else s.length > 0 ? s += `/${t.slice(r + 1, h)}` : s = t.slice(r + 1, h), i = h - r - 1;
            r = h, a = 0;
          } else o === "." && a !== -1 ? ++a : a = -1;
        }
        return s;
      }
      const rt = function(t) {
        return fi.test(t);
      }, Xe = function(t) {
        if (t === "..") return "";
        const e = di.exec(dt(t));
        return e && e[1] || "";
      }, Ut = function(t) {
        const e = dt(t).replace(/\/$/, "").split("/").slice(0, -1);
        return e.length === 1 && Qe.test(e[0]) && (e[0] += "/"), e.join("/") || (rt(t) ? "/" : ".");
      }, ts = function(t, e) {
        const s = dt(t).split("/");
        let i = "";
        for (let r = s.length - 1; r >= 0; r--) {
          const a = s[r];
          if (a) {
            i = a;
            break;
          }
        }
        return i;
      }, g = Cr, et = Ir, nt = kr, re = wr, vi = Rr, Mt = Ar, es = new Set(ft.builtinModules);
      function ne(t) {
        return t.replace(/\\/g, "/");
      }
      const yi = {}.hasOwnProperty, _i = /^([A-Z][a-z\d]*)+$/, Ei = /* @__PURE__ */ new Set(["string", "function", "number", "object", "Function", "Object", "boolean", "bigint", "symbol"]), D = {};
      function ae(t, e = "and") {
        return t.length < 3 ? t.join(` ${e} `) : `${t.slice(0, -1).join(", ")}, ${e} ${t[t.length - 1]}`;
      }
      const ss = /* @__PURE__ */ new Map();
      let is;
      function $(t, e, s) {
        return ss.set(t, e), /* @__PURE__ */ (function(i, r) {
          return a;
          function a(...o) {
            const h = Error.stackTraceLimit;
            oe() && (Error.stackTraceLimit = 0);
            const c = new i();
            oe() && (Error.stackTraceLimit = h);
            const p = (function(l, f, u) {
              const v = ss.get(l);
              if (et(v !== void 0, "expected `message` to be found"), typeof v == "function") return et(v.length <= f.length, `Code: ${l}; The provided arguments length (${f.length}) does not match the required ones (${v.length}).`), Reflect.apply(v, u, f);
              const k = /%[dfijoOs]/g;
              let y = 0;
              for (; k.exec(v) !== null; ) y++;
              return et(y === f.length, `Code: ${l}; The provided arguments length (${f.length}) does not match the required ones (${y}).`), f.length === 0 ? v : (f.unshift(v), Reflect.apply(Mt.format, null, f));
            })(r, o, c);
            return Object.defineProperties(c, { message: { value: p, enumerable: !1, writable: !0, configurable: !0 }, toString: { value() {
              return `${this.name} [${r}]: ${this.message}`;
            }, enumerable: !1, writable: !0, configurable: !0 } }), bi(c), c.code = r, c;
          }
        })(s, t);
      }
      function oe() {
        try {
          if (vi.startupSnapshot.isBuildingSnapshot()) return !1;
        } catch {
        }
        const t = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
        return t === void 0 ? Object.isExtensible(Error) : yi.call(t, "writable") && t.writable !== void 0 ? t.writable : t.set !== void 0;
      }
      D.ERR_INVALID_ARG_TYPE = $("ERR_INVALID_ARG_TYPE", (t, e, s) => {
        et(typeof t == "string", "'name' must be a string"), Array.isArray(e) || (e = [e]);
        let i = "The ";
        if (t.endsWith(" argument")) i += `${t} `;
        else {
          const h = t.includes(".") ? "property" : "argument";
          i += `"${t}" ${h} `;
        }
        i += "must be ";
        const r = [], a = [], o = [];
        for (const h of e) et(typeof h == "string", "All expected entries have to be of type string"), Ei.has(h) ? r.push(h.toLowerCase()) : _i.exec(h) === null ? (et(h !== "object", 'The value "object" should be written as "Object"'), o.push(h)) : a.push(h);
        if (a.length > 0) {
          const h = r.indexOf("object");
          h !== -1 && (r.slice(h, 1), a.push("Object"));
        }
        return r.length > 0 && (i += `${r.length > 1 ? "one of type" : "of type"} ${ae(r, "or")}`, (a.length > 0 || o.length > 0) && (i += " or ")), a.length > 0 && (i += `an instance of ${ae(a, "or")}`, o.length > 0 && (i += " or ")), o.length > 0 && (o.length > 1 ? i += `one of ${ae(o, "or")}` : (o[0].toLowerCase() !== o[0] && (i += "an "), i += `${o[0]}`)), i += `. Received ${(function(h) {
          if (h == null) return String(h);
          if (typeof h == "function" && h.name) return `function ${h.name}`;
          if (typeof h == "object") return h.constructor && h.constructor.name ? `an instance of ${h.constructor.name}` : `${(0, Mt.inspect)(h, { depth: -1 })}`;
          let c = (0, Mt.inspect)(h, { colors: !1 });
          return c.length > 28 && (c = `${c.slice(0, 25)}...`), `type ${typeof h} (${c})`;
        })(s)}`, i;
      }, TypeError), D.ERR_INVALID_MODULE_SPECIFIER = $("ERR_INVALID_MODULE_SPECIFIER", (t, e, s = void 0) => `Invalid module "${t}" ${e}${s ? ` imported from ${s}` : ""}`, TypeError), D.ERR_INVALID_PACKAGE_CONFIG = $("ERR_INVALID_PACKAGE_CONFIG", (t, e, s) => `Invalid package config ${t}${e ? ` while importing ${e}` : ""}${s ? `. ${s}` : ""}`, Error), D.ERR_INVALID_PACKAGE_TARGET = $("ERR_INVALID_PACKAGE_TARGET", (t, e, s, i = !1, r = void 0) => {
        const a = typeof s == "string" && !i && s.length > 0 && !s.startsWith("./");
        return e === "." ? (et(i === !1), `Invalid "exports" main target ${JSON.stringify(s)} defined in the package config ${t}package.json${r ? ` imported from ${r}` : ""}${a ? '; targets must start with "./"' : ""}`) : `Invalid "${i ? "imports" : "exports"}" target ${JSON.stringify(s)} defined for '${e}' in the package config ${t}package.json${r ? ` imported from ${r}` : ""}${a ? '; targets must start with "./"' : ""}`;
      }, Error), D.ERR_MODULE_NOT_FOUND = $("ERR_MODULE_NOT_FOUND", (t, e, s = !1) => `Cannot find ${s ? "module" : "package"} '${t}' imported from ${e}`, Error), D.ERR_NETWORK_IMPORT_DISALLOWED = $("ERR_NETWORK_IMPORT_DISALLOWED", "import of '%s' by %s is not supported: %s", Error), D.ERR_PACKAGE_IMPORT_NOT_DEFINED = $("ERR_PACKAGE_IMPORT_NOT_DEFINED", (t, e, s) => `Package import specifier "${t}" is not defined${e ? ` in package ${e}package.json` : ""} imported from ${s}`, TypeError), D.ERR_PACKAGE_PATH_NOT_EXPORTED = $("ERR_PACKAGE_PATH_NOT_EXPORTED", (t, e, s = void 0) => e === "." ? `No "exports" main defined in ${t}package.json${s ? ` imported from ${s}` : ""}` : `Package subpath '${e}' is not defined by "exports" in ${t}package.json${s ? ` imported from ${s}` : ""}`, Error), D.ERR_UNSUPPORTED_DIR_IMPORT = $("ERR_UNSUPPORTED_DIR_IMPORT", "Directory import '%s' is not supported resolving ES modules imported from %s", Error), D.ERR_UNSUPPORTED_RESOLVE_REQUEST = $("ERR_UNSUPPORTED_RESOLVE_REQUEST", 'Failed to resolve module specifier "%s" from "%s": Invalid relative URL or base scheme is not hierarchical.', TypeError), D.ERR_UNKNOWN_FILE_EXTENSION = $("ERR_UNKNOWN_FILE_EXTENSION", (t, e) => `Unknown file extension "${t}" for ${e}`, TypeError), D.ERR_INVALID_ARG_VALUE = $("ERR_INVALID_ARG_VALUE", (t, e, s = "is invalid") => {
        let i = (0, Mt.inspect)(e);
        return i.length > 128 && (i = `${i.slice(0, 128)}...`), `The ${t.includes(".") ? "property" : "argument"} '${t}' ${s}. Received ${i}`;
      }, TypeError);
      const bi = (function(t) {
        const e = "__node_internal_" + t.name;
        return Object.defineProperty(t, "name", { value: e }), t;
      })(function(t) {
        const e = oe();
        return e && (is = Error.stackTraceLimit, Error.stackTraceLimit = Number.POSITIVE_INFINITY), Error.captureStackTrace(t), e && (Error.stackTraceLimit = is), t;
      }), It = {}.hasOwnProperty, { ERR_INVALID_PACKAGE_CONFIG: Si } = D, rs = /* @__PURE__ */ new Map();
      function ns(t, { base: e, specifier: s }) {
        const i = rs.get(t);
        if (i) return i;
        let r;
        try {
          r = O.readFileSync(re.toNamespacedPath(t), "utf8");
        } catch (o) {
          const h = o;
          if (h.code !== "ENOENT") throw h;
        }
        const a = { exists: !1, pjsonPath: t, main: void 0, name: void 0, type: "none", exports: void 0, imports: void 0 };
        if (r !== void 0) {
          let o;
          try {
            o = JSON.parse(r);
          } catch (h) {
            const c = h, p = new Si(t, (e ? `"${s}" from ` : "") + (0, g.fileURLToPath)(e || s), c.message);
            throw p.cause = c, p;
          }
          a.exists = !0, It.call(o, "name") && typeof o.name == "string" && (a.name = o.name), It.call(o, "main") && typeof o.main == "string" && (a.main = o.main), It.call(o, "exports") && (a.exports = o.exports), It.call(o, "imports") && (a.imports = o.imports), !It.call(o, "type") || o.type !== "commonjs" && o.type !== "module" || (a.type = o.type);
        }
        return rs.set(t, a), a;
      }
      function he(t) {
        let e = new URL("package.json", t);
        for (; !e.pathname.endsWith("node_modules/package.json"); ) {
          const s = ns((0, g.fileURLToPath)(e), { specifier: t });
          if (s.exists) return s;
          const i = e;
          if (e = new URL("../package.json", e), e.pathname === i.pathname) break;
        }
        return { pjsonPath: (0, g.fileURLToPath)(e), exists: !1, type: "none" };
      }
      function as(t) {
        return he(t).type;
      }
      const { ERR_UNKNOWN_FILE_EXTENSION: Ci } = D, Ii = {}.hasOwnProperty, ki = { __proto__: null, ".cjs": "commonjs", ".js": "module", ".json": "json", ".mjs": "module" }, os = { __proto__: null, "data:": function(t) {
        const { 1: e } = /^([^/]+\/[^;,]+)[^,]*?(;base64)?,/.exec(t.pathname) || [null, null, null];
        return (function(s) {
          return s && /\s*(text|application)\/javascript\s*(;\s*charset=utf-?8\s*)?/i.test(s) ? "module" : s === "application/json" ? "json" : null;
        })(e);
      }, "file:": function(t, e, s) {
        const i = (function(o) {
          const h = o.pathname;
          let c = h.length;
          for (; c--; ) {
            const p = h.codePointAt(c);
            if (p === 47) return "";
            if (p === 46) return h.codePointAt(c - 1) === 47 ? "" : h.slice(c);
          }
          return "";
        })(t);
        if (i === ".js") {
          const o = as(t);
          return o !== "none" ? o : "commonjs";
        }
        if (i === "") {
          const o = as(t);
          return o === "none" || o === "commonjs" ? "commonjs" : "module";
        }
        const r = ki[i];
        if (r) return r;
        if (s) return;
        const a = (0, g.fileURLToPath)(t);
        throw new Ci(i, a);
      }, "http:": hs, "https:": hs, "node:": () => "builtin" };
      function hs() {
      }
      const jt = RegExp.prototype[Symbol.replace], { ERR_INVALID_MODULE_SPECIFIER: Bt, ERR_INVALID_PACKAGE_CONFIG: cs, ERR_INVALID_PACKAGE_TARGET: wi, ERR_MODULE_NOT_FOUND: ce, ERR_PACKAGE_IMPORT_NOT_DEFINED: Ri, ERR_PACKAGE_PATH_NOT_EXPORTED: Ai, ERR_UNSUPPORTED_DIR_IMPORT: Ti, ERR_UNSUPPORTED_RESOLVE_REQUEST: ls } = D, ps = {}.hasOwnProperty, us = /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))?(\\|\/|$)/i, fs = /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))(\\|\/|$)/i, Pi = /^\.|%|\\/, Ft = /\*/g, Ni = /%2f|%5c/i, ds = /* @__PURE__ */ new Set(), Li = /[/\\]{2}/;
      function ms(t, e, s, i, r, a, o) {
        if (nt.noDeprecation) return;
        const h = (0, g.fileURLToPath)(i), c = Li.exec(o ? t : e) !== null;
        nt.emitWarning(`Use of deprecated ${c ? "double slash" : "leading or trailing slash matching"} resolving "${t}" for module request "${e}" ${e === s ? "" : `matched to "${s}" `}in the "${r ? "imports" : "exports"}" field module resolution of the package at ${h}${a ? ` imported from ${(0, g.fileURLToPath)(a)}` : ""}.`, "DeprecationWarning", "DEP0166");
      }
      function gs(t, e, s, i) {
        if (nt.noDeprecation || (function(c, p) {
          const l = c.protocol;
          return Ii.call(os, l) && os[l](c, p, !0) || null;
        })(t, { parentURL: s.href }) !== "module") return;
        const a = (0, g.fileURLToPath)(t.href), o = (0, g.fileURLToPath)(new g.URL(".", e)), h = (0, g.fileURLToPath)(s);
        i ? re.resolve(o, i) !== a && nt.emitWarning(`Package ${o} has a "main" field set to "${i}", excluding the full filename and extension to the resolved file at "${a.slice(o.length)}", imported from ${h}.
 Automatic extension resolution of the "main" field is deprecated for ES modules.`, "DeprecationWarning", "DEP0151") : nt.emitWarning(`No "main" or "exports" field defined in the package.json for ${o} resolving the main entry point "${a.slice(o.length)}", imported from ${h}.
Default "index" lookups for the main are deprecated for ES modules.`, "DeprecationWarning", "DEP0151");
      }
      function xs(t) {
        try {
          return (0, O.statSync)(t);
        } catch {
        }
      }
      function le(t) {
        const e = (0, O.statSync)(t, { throwIfNoEntry: !1 }), s = e ? e.isFile() : void 0;
        return s != null && s;
      }
      function Oi(t, e, s) {
        let i;
        if (e.main !== void 0) {
          if (i = new g.URL(e.main, t), le(i)) return i;
          const o = [`./${e.main}.js`, `./${e.main}.json`, `./${e.main}.node`, `./${e.main}/index.js`, `./${e.main}/index.json`, `./${e.main}/index.node`];
          let h = -1;
          for (; ++h < o.length && (i = new g.URL(o[h], t), !le(i)); ) i = void 0;
          if (i) return gs(i, t, s, e.main), i;
        }
        const r = ["./index.js", "./index.json", "./index.node"];
        let a = -1;
        for (; ++a < r.length && (i = new g.URL(r[a], t), !le(i)); ) i = void 0;
        if (i) return gs(i, t, s, e.main), i;
        throw new ce((0, g.fileURLToPath)(new g.URL(".", t)), (0, g.fileURLToPath)(s));
      }
      function pe(t, e, s) {
        return new Ai((0, g.fileURLToPath)(new g.URL(".", e)), t, s && (0, g.fileURLToPath)(s));
      }
      function kt(t, e, s, i, r) {
        return e = typeof e == "object" && e !== null ? JSON.stringify(e, null, "") : `${e}`, new wi((0, g.fileURLToPath)(new g.URL(".", s)), t, e, i, r && (0, g.fileURLToPath)(r));
      }
      function Di(t, e, s, i, r, a, o, h, c) {
        if (e !== "" && !a && t[t.length - 1] !== "/") throw kt(s, t, i, o, r);
        if (!t.startsWith("./")) {
          if (o && !t.startsWith("../") && !t.startsWith("/")) {
            let u = !1;
            try {
              new g.URL(t), u = !0;
            } catch {
            }
            if (!u)
              return _s(a ? jt.call(Ft, t, () => e) : t + e, i, c);
          }
          throw kt(s, t, i, o, r);
        }
        if (us.exec(t.slice(2)) !== null) {
          if (fs.exec(t.slice(2)) !== null) throw kt(s, t, i, o, r);
          if (!h) {
            const u = a ? s.replace("*", () => e) : s + e;
            ms(a ? jt.call(Ft, t, () => e) : t, u, s, i, o, r, !0);
          }
        }
        const p = new g.URL(t, i), l = p.pathname, f = new g.URL(".", i).pathname;
        if (!l.startsWith(f)) throw kt(s, t, i, o, r);
        if (e === "") return p;
        if (us.exec(e) !== null) {
          const u = a ? s.replace("*", () => e) : s + e;
          fs.exec(e) === null ? h || ms(a ? jt.call(Ft, t, () => e) : t, u, s, i, o, r, !1) : (function(v, k, y, C, S) {
            const I = `request is not a valid match in pattern "${k}" for the "${C ? "imports" : "exports"}" resolution of ${(0, g.fileURLToPath)(y)}`;
            throw new Bt(v, I, S && (0, g.fileURLToPath)(S));
          })(u, s, i, o, r);
        }
        return a ? new g.URL(jt.call(Ft, p.href, () => e)) : new g.URL(e, p);
      }
      function Vi(t) {
        const e = Number(t);
        return `${e}` === t && e >= 0 && e < 4294967295;
      }
      function mt(t, e, s, i, r, a, o, h, c) {
        if (typeof e == "string") return Di(e, s, i, t, r, a, o, h, c);
        if (Array.isArray(e)) {
          const p = e;
          if (p.length === 0) return null;
          let l, f = -1;
          for (; ++f < p.length; ) {
            const u = p[f];
            let v;
            try {
              v = mt(t, u, s, i, r, a, o, h, c);
            } catch (k) {
              if (l = k, k.code === "ERR_INVALID_PACKAGE_TARGET") continue;
              throw k;
            }
            if (v !== void 0) {
              if (v !== null) return v;
              l = null;
            }
          }
          if (l == null) return null;
          throw l;
        }
        if (typeof e == "object" && e !== null) {
          const p = Object.getOwnPropertyNames(e);
          let l = -1;
          for (; ++l < p.length; )
            if (Vi(p[l])) throw new cs((0, g.fileURLToPath)(t), r, '"exports" cannot contain numeric property keys.');
          for (l = -1; ++l < p.length; ) {
            const f = p[l];
            if (f === "default" || c && c.has(f)) {
              const u = mt(t, e[f], s, i, r, a, o, h, c);
              if (u === void 0) continue;
              return u;
            }
          }
          return null;
        }
        if (e === null) return null;
        throw kt(i, e, t, o, r);
      }
      function Ui(t, e, s) {
        if (nt.noDeprecation) return;
        const i = (0, g.fileURLToPath)(e);
        ds.has(i + "|" + t) || (ds.add(i + "|" + t), nt.emitWarning(`Use of deprecated trailing slash pattern mapping "${t}" in the "exports" field module resolution of the package at ${i}${s ? ` imported from ${(0, g.fileURLToPath)(s)}` : ""}. Mapping specifiers ending in "/" is no longer supported.`, "DeprecationWarning", "DEP0155"));
      }
      function vs(t, e, s, i, r) {
        let a = s.exports;
        if ((function(l, f, u) {
          if (typeof l == "string" || Array.isArray(l)) return !0;
          if (typeof l != "object" || l === null) return !1;
          const v = Object.getOwnPropertyNames(l);
          let k = !1, y = 0, C = -1;
          for (; ++C < v.length; ) {
            const S = v[C], I = S === "" || S[0] !== ".";
            if (y++ === 0) k = I;
            else if (k !== I) throw new cs((0, g.fileURLToPath)(f), u, `"exports" cannot contain some keys starting with '.' and some not. The exports object must either be an object of package subpath keys or an object of main entry condition name keys only.`);
          }
          return k;
        })(a, t, i) && (a = { ".": a }), ps.call(a, e) && !e.includes("*") && !e.endsWith("/")) {
          const l = mt(t, a[e], "", e, i, !1, !1, !1, r);
          if (l == null) throw pe(e, t, i);
          return l;
        }
        let o = "", h = "";
        const c = Object.getOwnPropertyNames(a);
        let p = -1;
        for (; ++p < c.length; ) {
          const l = c[p], f = l.indexOf("*");
          if (f !== -1 && e.startsWith(l.slice(0, f))) {
            e.endsWith("/") && Ui(e, t, i);
            const u = l.slice(f + 1);
            e.length >= l.length && e.endsWith(u) && ys(o, l) === 1 && l.lastIndexOf("*") === f && (o = l, h = e.slice(f, e.length - u.length));
          }
        }
        if (o) {
          const l = mt(t, a[o], h, o, i, !0, !1, e.endsWith("/"), r);
          if (l == null) throw pe(e, t, i);
          return l;
        }
        throw pe(e, t, i);
      }
      function ys(t, e) {
        const s = t.indexOf("*"), i = e.indexOf("*"), r = s === -1 ? t.length : s + 1, a = i === -1 ? e.length : i + 1;
        return r > a ? -1 : a > r || s === -1 ? 1 : i === -1 || t.length > e.length ? -1 : e.length > t.length ? 1 : 0;
      }
      function Mi(t, e, s) {
        if (t === "#" || t.startsWith("#/") || t.endsWith("/"))
          throw new Bt(t, "is not a valid internal imports specifier name", (0, g.fileURLToPath)(e));
        let i;
        const r = he(e);
        if (r.exists) {
          i = (0, g.pathToFileURL)(r.pjsonPath);
          const a = r.imports;
          if (a) if (ps.call(a, t) && !t.includes("*")) {
            const o = mt(i, a[t], "", t, e, !1, !0, !1, s);
            if (o != null) return o;
          } else {
            let o = "", h = "";
            const c = Object.getOwnPropertyNames(a);
            let p = -1;
            for (; ++p < c.length; ) {
              const l = c[p], f = l.indexOf("*");
              if (f !== -1 && t.startsWith(l.slice(0, -1))) {
                const u = l.slice(f + 1);
                t.length >= l.length && t.endsWith(u) && ys(o, l) === 1 && l.lastIndexOf("*") === f && (o = l, h = t.slice(f, t.length - u.length));
              }
            }
            if (o) {
              const l = mt(i, a[o], h, o, e, !0, !0, !1, s);
              if (l != null) return l;
            }
          }
        }
        throw (function(a, o, h) {
          return new Ri(a, o && (0, g.fileURLToPath)(new g.URL(".", o)), (0, g.fileURLToPath)(h));
        })(t, i, e);
      }
      function _s(t, e, s) {
        if (ft.builtinModules.includes(t)) return new g.URL("node:" + t);
        const { packageName: i, packageSubpath: r, isScoped: a } = (function(l, f) {
          let u = l.indexOf("/"), v = !0, k = !1;
          l[0] === "@" && (k = !0, u === -1 || l.length === 0 ? v = !1 : u = l.indexOf("/", u + 1));
          const y = u === -1 ? l : l.slice(0, u);
          if (Pi.exec(y) !== null && (v = !1), !v) throw new Bt(l, "is not a valid package name", (0, g.fileURLToPath)(f));
          return { packageName: y, packageSubpath: "." + (u === -1 ? "" : l.slice(u)), isScoped: k };
        })(t, e), o = he(e);
        if (o.exists) {
          const l = (0, g.pathToFileURL)(o.pjsonPath);
          if (o.name === i && o.exports !== void 0 && o.exports !== null) return vs(l, r, o, e, s);
        }
        let h, c = new g.URL("./node_modules/" + i + "/package.json", e), p = (0, g.fileURLToPath)(c);
        do {
          const l = xs(p.slice(0, -13));
          if (!l || !l.isDirectory()) {
            h = p, c = new g.URL((a ? "../../../../node_modules/" : "../../../node_modules/") + i + "/package.json", c), p = (0, g.fileURLToPath)(c);
            continue;
          }
          const f = ns(p, { base: e, specifier: t });
          return f.exports !== void 0 && f.exports !== null ? vs(c, r, f, e, s) : r === "." ? Oi(c, f, e) : new g.URL(r, c);
        } while (p.length !== h.length);
        throw new ce(i, (0, g.fileURLToPath)(e), !1);
      }
      function ji(t, e, s, i) {
        const r = e.protocol, a = r === "data:" || r === "http:" || r === "https:";
        let o;
        if ((function(h) {
          return h !== "" && (h[0] === "/" || (function(c) {
            return c[0] === "." && (c.length === 1 || c[1] === "/" || c[1] === "." && (c.length === 2 || c[2] === "/"));
          })(h));
        })(t)) try {
          o = new g.URL(t, e);
        } catch (h) {
          const c = new ls(t, e);
          throw c.cause = h, c;
        }
        else if (r === "file:" && t[0] === "#") o = Mi(t, e, s);
        else try {
          o = new g.URL(t);
        } catch (h) {
          if (a && !ft.builtinModules.includes(t)) {
            const c = new ls(t, e);
            throw c.cause = h, c;
          }
          o = _s(t, e, s);
        }
        return et(o !== void 0, "expected to be defined"), o.protocol !== "file:" ? o : (function(h, c) {
          if (Ni.exec(h.pathname) !== null) throw new Bt(h.pathname, 'must not include encoded "/" or "\\" characters', (0, g.fileURLToPath)(c));
          let p;
          try {
            p = (0, g.fileURLToPath)(h);
          } catch (f) {
            const u = f;
            throw Object.defineProperty(u, "input", { value: String(h) }), Object.defineProperty(u, "module", { value: String(c) }), u;
          }
          const l = xs(p.endsWith("/") ? p.slice(-1) : p);
          if (l && l.isDirectory()) {
            const f = new Ti(p, (0, g.fileURLToPath)(c));
            throw f.url = String(h), f;
          }
          if (!l || !l.isFile()) {
            const f = new ce(p || h.pathname, c && (0, g.fileURLToPath)(c), !0);
            throw f.url = String(h), f;
          }
          {
            const f = (0, O.realpathSync)(p), { search: u, hash: v } = h;
            (h = (0, g.pathToFileURL)(f + (p.endsWith(re.sep) ? "/" : ""))).search = u, h.hash = v;
          }
          return h;
        })(o, e);
      }
      function wt(t) {
        return typeof t != "string" || t.startsWith("file://") ? ne((0, g.fileURLToPath)(t)) : ne(t);
      }
      function gt(t) {
        return (0, g.pathToFileURL)(wt(t)).toString();
      }
      const Bi = /* @__PURE__ */ new Set(["node", "import"]), Fi = [".mjs", ".cjs", ".js", ".json"], $i = /* @__PURE__ */ new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED"]);
      function Es(t, e, s) {
        try {
          return ji(t, e, s);
        } catch (i) {
          if (!$i.has(i?.code)) throw i;
        }
      }
      function qi(t, e = {}) {
        if (typeof t != "string") {
          if (!(t instanceof URL)) throw new TypeError("input must be a `string` or `URL`");
          t = wt(t);
        }
        if (/(?:node|data|http|https):/.test(t)) return t;
        if (es.has(t)) return "node:" + t;
        if (t.startsWith("file://") && (t = wt(t)), rt(t)) try {
          if ((0, O.statSync)(t).isFile()) return gt(t);
        } catch (o) {
          if (o?.code !== "ENOENT") throw o;
        }
        const s = e.conditions ? new Set(e.conditions) : Bi, i = (Array.isArray(e.url) ? e.url : [e.url]).filter(Boolean).map((o) => new URL((function(h) {
          return typeof h != "string" && (h = h.toString()), /(?:node|data|http|https|file):/.test(h) ? h : es.has(h) ? "node:" + h : "file://" + encodeURI(ne(h));
        })(o.toString())));
        i.length === 0 && i.push(new URL(gt(process.cwd())));
        const r = [...i];
        for (const o of i) o.protocol === "file:" && r.push(new URL("./", o), new URL(Ye(o.pathname, "_index.js"), o), new URL("node_modules", o));
        let a;
        for (const o of r) {
          if (a = Es(t, o, s), a) break;
          for (const h of ["", "/index"]) {
            for (const c of e.extensions || Fi) if (a = Es(Ye(t, h) + c, o, s), a) break;
            if (a) break;
          }
          if (a) break;
        }
        if (!a) {
          const o = new Error(`Cannot find module ${t} imported from ${r.join(", ")}`);
          throw o.code = "ERR_MODULE_NOT_FOUND", o;
        }
        return gt(a);
      }
      function Wi(t, e) {
        return qi(t, e);
      }
      function Gi(t, e) {
        return wt(Wi(t, e));
      }
      const Hi = /(?:[\s;]|^)(?:import[\s\w*,{}]*from|import\s*["'*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m, Ki = /\/\*.+?\*\/|\/\/.*(?=[nr])/g;
      function zi(t, e = {}) {
        return e.stripComments && (t = t.replace(Ki, "")), Hi.test(t);
      }
      function bs(t) {
        if (typeof t != "string") throw new TypeError("Expected a string");
        return t.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
      }
      const Ji = /* @__PURE__ */ new Set(["/", "\\", void 0]), Ss = /* @__PURE__ */ Symbol.for("pathe:normalizedAlias"), Yi = /[/\\]/;
      function Cs(t) {
        if (t[Ss]) return t;
        const e = Object.fromEntries(Object.entries(t).sort(([s], [i]) => (function(r, a) {
          return a.split("/").length - r.split("/").length;
        })(s, i)));
        for (const s in e) for (const i in e) i === s || s.startsWith(i) || e[s]?.startsWith(i) && Ji.has(e[s][i.length]) && (e[s] = e[i] + e[s].slice(i.length));
        return Object.defineProperty(e, Ss, { value: !0, enumerable: !1 }), e;
      }
      function Is(t = "/") {
        const e = t[t.length - 1];
        return e === "/" || e === "\\";
      }
      var Qi = { rE: "2.6.1" };
      const Zi = Tr;
      var ue = W.n(Zi);
      const $t = /* @__PURE__ */ Object.create(null), Rt = (t) => globalThis.process?.env || globalThis.Deno?.env.toObject() || globalThis.__env__ || (t ? $t : globalThis), st = new Proxy($t, { get: (t, e) => Rt()[e] ?? $t[e], has: (t, e) => e in Rt() || e in $t, set: (t, e, s) => (Rt(!0)[e] = s, !0), deleteProperty(t, e) {
        return e ? (delete Rt(!0)[e], !0) : !1;
      }, ownKeys() {
        const t = Rt(!0);
        return Object.keys(t);
      } }), Xi = typeof process < "u" && process.env && process.env.NODE_ENV || "", tr = [["APPVEYOR"], ["AWS_AMPLIFY", "AWS_APP_ID", { ci: !0 }], ["AZURE_PIPELINES", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"], ["AZURE_STATIC", "INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN"], ["APPCIRCLE", "AC_APPCIRCLE"], ["BAMBOO", "bamboo_planKey"], ["BITBUCKET", "BITBUCKET_COMMIT"], ["BITRISE", "BITRISE_IO"], ["BUDDY", "BUDDY_WORKSPACE_ID"], ["BUILDKITE"], ["CIRCLE", "CIRCLECI"], ["CIRRUS", "CIRRUS_CI"], ["CLOUDFLARE_PAGES", "CF_PAGES", { ci: !0 }], ["CLOUDFLARE_WORKERS", "WORKERS_CI", { ci: !0 }], ["CODEBUILD", "CODEBUILD_BUILD_ARN"], ["CODEFRESH", "CF_BUILD_ID"], ["DRONE"], ["DRONE", "DRONE_BUILD_EVENT"], ["DSARI"], ["GITHUB_ACTIONS"], ["GITLAB", "GITLAB_CI"], ["GITLAB", "CI_MERGE_REQUEST_ID"], ["GOCD", "GO_PIPELINE_LABEL"], ["LAYERCI"], ["HUDSON", "HUDSON_URL"], ["JENKINS", "JENKINS_URL"], ["MAGNUM"], ["NETLIFY"], ["NETLIFY", "NETLIFY_LOCAL", { ci: !1 }], ["NEVERCODE"], ["RENDER"], ["SAIL", "SAILCI"], ["SEMAPHORE"], ["SCREWDRIVER"], ["SHIPPABLE"], ["SOLANO", "TDDIUM"], ["STRIDER"], ["TEAMCITY", "TEAMCITY_VERSION"], ["TRAVIS"], ["VERCEL", "NOW_BUILDER"], ["VERCEL", "VERCEL", { ci: !1 }], ["VERCEL", "VERCEL_ENV", { ci: !1 }], ["APPCENTER", "APPCENTER_BUILD_ID"], ["CODESANDBOX", "CODESANDBOX_SSE", { ci: !1 }], ["CODESANDBOX", "CODESANDBOX_HOST", { ci: !1 }], ["STACKBLITZ"], ["STORMKIT"], ["CLEAVR"], ["ZEABUR"], ["CODESPHERE", "CODESPHERE_APP_ID", { ci: !0 }], ["RAILWAY", "RAILWAY_PROJECT_ID"], ["RAILWAY", "RAILWAY_SERVICE_ID"], ["DENO-DEPLOY", "DENO_DEPLOYMENT_ID"], ["FIREBASE_APP_HOSTING", "FIREBASE_APP_HOSTING", { ci: !0 }]], ks = (function() {
        if (globalThis.process?.env) for (const t of tr) {
          const e = t[1] || t[0];
          if (globalThis.process?.env[e]) return { name: t[0].toLowerCase(), ...t[2] };
        }
        return globalThis.process?.env?.SHELL === "/bin/jsh" && globalThis.process?.versions?.webcontainer ? { name: "stackblitz", ci: !1 } : { name: "", ci: !1 };
      })();
      ks.name;
      function at(t) {
        return !!t && t !== "false";
      }
      const er = globalThis.process?.platform || "";
      at(st.CI) || ks.ci;
      const sr = at(globalThis.process?.stdout && globalThis.process?.stdout.isTTY);
      at(st.DEBUG), Xi === "test" || at(st.TEST);
      const ws = (at(st.MINIMAL), /^win/i.test(er)), ir = (!at(st.NO_COLOR) && (at(st.FORCE_COLOR) || (sr || ws) && st.TERM), (globalThis.process?.versions?.node || "").replace(/^v/, "") || null), rr = (Number(ir?.split(".")[0]), globalThis.process || /* @__PURE__ */ Object.create(null)), Rs = { versions: {} }, nr = (new Proxy(rr, { get: (t, e) => e === "env" ? st : e in t ? t[e] : e in Rs ? Rs[e] : void 0 }), globalThis.process?.release?.name === "node"), ar = !!globalThis.Bun || !!globalThis.process?.versions?.bun, or = !!globalThis.Deno, hr = !!globalThis.fastly, cr = [[!!globalThis.Netlify, "netlify"], [!!globalThis.EdgeRuntime, "edge-light"], [globalThis.navigator?.userAgent === "Cloudflare-Workers", "workerd"], [hr, "fastly"], [or, "deno"], [ar, "bun"], [nr, "node"]];
      (function() {
        const t = cr.find((e) => e[0]);
        t && t[1];
      })();
      const lr = Pr, pr = lr?.WriteStream?.prototype?.hasColors?.() ?? !1, xt = (t, e) => {
        if (!pr) return (r) => r;
        const s = `\x1B[${t}m`, i = `\x1B[${e}m`;
        return (r) => {
          const a = r + "";
          let o = a.indexOf(i);
          if (o === -1) return s + a + i;
          let h = s, c = 0;
          const p = (e === 22 ? i : "") + s;
          for (; o !== -1; ) h += a.slice(c, o) + p, c = o + i.length, o = a.indexOf(i, c);
          return h += a.slice(c) + i, h;
        };
      }, As = xt(31, 39), vt = xt(32, 39), qt = xt(33, 39), Ts = xt(34, 39), ur = xt(36, 39), fr = xt(90, 39);
      function Ps(t) {
        if (typeof t != "string" || t.startsWith("file://")) return !1;
        try {
          return (0, O.lstatSync)(t).isDirectory();
        } catch {
          return !1;
        }
      }
      function Ns(t, e = 8) {
        return ((function() {
          if (yt !== void 0) return yt;
          try {
            return yt = !!ue().getFips?.(), yt;
          } catch {
            return yt = !1, yt;
          }
        })() ? ue().createHash("sha256") : ue().createHash("md5")).update(t).digest("hex").slice(0, e);
      }
      const Ls = { true: vt("true"), false: qt("false"), "[rebuild]": qt("[rebuild]"), "[esm]": Ts("[esm]"), "[cjs]": vt("[cjs]"), "[import]": Ts("[import]"), "[require]": vt("[require]"), "[native]": ur("[native]"), "[transpile]": qt("[transpile]"), "[fallback]": As("[fallback]"), "[unknown]": As("[unknown]"), "[hit]": vt("[hit]"), "[miss]": qt("[miss]"), "[json]": vt("[json]"), "[data]": vt("[data]") };
      function T(t, ...e) {
        if (!t.opts.debug) return;
        const s = process.cwd();
        console.log(fr(["[jiti]", ...e.map((i) => i in Ls ? Ls[i] : typeof i != "string" ? JSON.stringify(i) : i.replace(s, "."))].join(" ")));
      }
      function ot(t, e) {
        return t.opts.interopDefault ? (function(s) {
          const i = typeof s;
          if (s === null || i !== "object" && i !== "function") return s;
          const r = s.default, a = typeof r, o = r == null, h = a === "object" || a === "function";
          return o && s instanceof Promise ? s : new Proxy(s, { get(c, p, l) {
            if (p === "__esModule") return !0;
            if (p === "default") return o ? s : typeof r?.default == "function" && s.__esModule ? r.default : r;
            if (Reflect.has(c, p)) return Reflect.get(c, p, l);
            if (h && !(r instanceof Promise)) {
              let f = Reflect.get(r, p, l);
              return typeof f == "function" && (f = f.bind(r)), f;
            }
          }, apply: (c, p, l) => typeof c == "function" ? Reflect.apply(c, p, l) : a === "function" ? Reflect.apply(r, p, l) : void 0 });
        })(e) : e;
      }
      let yt;
      function Y(t, e) {
        return !!_t(t, e);
      }
      function _t(t, e) {
        const s = process.env[t];
        if (!(t in process.env)) return e;
        try {
          return JSON.parse(s);
        } catch {
          return e;
        }
      }
      const Os = /\.(c|m)?j(sx?)$/, Ds = /\.(c|m)?t(sx?)$/;
      function At(t, e, s) {
        let i, r;
        if (t.isNativeRe.test(e)) return e;
        t.alias && (e = (function(h, c) {
          const p = dt(h);
          c = Cs(c);
          for (const [l, f] of Object.entries(c)) {
            if (!p.startsWith(l)) continue;
            const u = Is(l) ? l.slice(0, -1) : l;
            if (Is(p[u.length])) return tt(f, p.slice(l.length));
          }
          return p;
        })(e, t.alias));
        let a = s?.parentURL || t.url;
        Ps(a) && (a = tt(a, "_index.js"));
        const o = (s?.async ? [s?.conditions, ["node", "import"], ["node", "require"]] : [s?.conditions, ["node", "require"], ["node", "import"]]).filter(Boolean);
        for (const h of o) {
          try {
            i = Gi(e, { url: a, conditions: h, extensions: t.opts.extensions });
          } catch (c) {
            r = c;
          }
          if (i) return i;
        }
        try {
          return t.nativeRequire.resolve(e, { paths: s.paths });
        } catch (h) {
          r = h;
        }
        for (const h of t.additionalExts)
          if (i = fe(t, e + h, a, s) || fe(t, e + "/index" + h, a, s), i || (Ds.test(t.filename) || Ds.test(t.parentModule?.filename || "") || Os.test(e)) && (i = fe(t, e.replace(Os, ".$1t$2"), a, s), i)) return i;
        if (!s?.try) throw r;
      }
      function fe(t, e, s, i) {
        try {
          return t.nativeRequire.resolve(e, { ...i, paths: [Ut(wt(s)), ...i?.paths || []] });
        } catch {
        }
      }
      const Vs = Nr, dr = Lr;
      var mr = W.n(dr);
      function de(t, e, s) {
        const i = t.parentCache || {};
        if (e.startsWith("node:")) return ht(t, e, s.async);
        if (e.startsWith("file:")) e = (0, g.fileURLToPath)(e);
        else if (e.startsWith("data:")) {
          if (!s.async) throw new Error("`data:` URLs are only supported in ESM context. Use `import` or `jiti.import` instead.");
          return T(t, "[native]", "[data]", "[import]", e), ht(t, e, !0);
        }
        if (ft.builtinModules.includes(e) || e === ".pnp.js") return ht(t, e, s.async);
        if (t.opts.tryNative && !t.opts.transformOptions) try {
          if (!(e = At(t, e, s)) && s.try) return;
          if (T(t, "[try-native]", s.async && t.nativeImport ? "[import]" : "[require]", e), s.async && t.nativeImport) return t.nativeImport(e).then((h) => (t.opts.moduleCache === !1 && delete t.nativeRequire.cache[e], ot(t, h)));
          {
            const h = t.nativeRequire(e);
            return t.opts.moduleCache === !1 && delete t.nativeRequire.cache[e], ot(t, h);
          }
        } catch (h) {
          T(t, `[try-native] Using fallback for ${e} because of an error:`, h);
        }
        const r = At(t, e, s);
        if (!r && s.try) return;
        const a = Xe(r);
        if (a === ".json") {
          T(t, "[json]", r);
          const h = t.nativeRequire(r);
          return h && !("default" in h) && Object.defineProperty(h, "default", { value: h, enumerable: !1 }), h;
        }
        if (a && !t.opts.extensions.includes(a)) return T(t, "[native]", "[unknown]", s.async ? "[import]" : "[require]", r), ht(t, r, s.async);
        if (t.isNativeRe.test(r)) return T(t, "[native]", s.async ? "[import]" : "[require]", r), ht(t, r, s.async);
        if (i[r]) return ot(t, i[r]?.exports);
        if (t.opts.moduleCache) {
          const h = t.nativeRequire.cache[r];
          if (h?.loaded) return ot(t, h.exports);
        }
        const o = (0, O.readFileSync)(r, "utf8");
        return ge(t, o, { id: e, filename: r, ext: a, cache: i, async: s.async });
      }
      function ht(t, e, s) {
        return s && t.nativeImport ? t.nativeImport((function(i) {
          return ws && rt(i) ? gt(i) : i;
        })(e)).then((i) => ot(t, i)) : ot(t, t.nativeRequire(e));
      }
      const gr = "9";
      function xr(t, e, s) {
        if (!t.opts.fsCache || !e.filename) return s();
        const i = ` /* v${gr}-${Ns(e.source, 16)} */
`;
        let r = `${ts(Ut(e.filename))}-${(function(c) {
          const p = c.split(Yi).pop();
          if (!p) return;
          const l = p.lastIndexOf(".");
          return l <= 0 ? p : p.slice(0, l);
        })(e.filename)}` + (t.opts.sourceMaps ? "+map" : "") + (e.interopDefault ? ".i" : "") + `.${Ns(e.filename)}` + (e.async ? ".mjs" : ".cjs");
        e.jsx && e.filename.endsWith("x") && (r += "x");
        const a = t.opts.fsCache, o = tt(a, r);
        if (!t.opts.rebuildFsCache && (0, O.existsSync)(o)) {
          const c = (0, O.readFileSync)(o, "utf8");
          if (c.endsWith(i)) return T(t, "[cache]", "[hit]", e.filename, "~>", o), c;
        }
        T(t, "[cache]", "[miss]", e.filename);
        const h = s();
        return h.includes("__JITI_ERROR__") || ((0, O.writeFileSync)(o, h + i, "utf8"), T(t, "[cache]", "[store]", e.filename, "~>", o)), h;
      }
      function vr(t) {
        if (t.opts.fsCache === !0 && (t.opts.fsCache = (function(e) {
          const s = e.filename && xi(e.filename, "../node_modules");
          if (s && (0, O.existsSync)(s)) return tt(s, ".cache/jiti");
          let i = (0, A.tmpdir)();
          if (process.env.TMPDIR && i === process.cwd() && !process.env.JITI_RESPECT_TMPDIR_ENV) {
            const r = process.env.TMPDIR;
            delete process.env.TMPDIR, i = (0, A.tmpdir)(), process.env.TMPDIR = r;
          }
          return tt(i, "jiti");
        })(t)), t.opts.fsCache) try {
          if ((0, O.mkdirSync)(t.opts.fsCache, { recursive: !0 }), !(function(e) {
            try {
              return (0, O.accessSync)(e, O.constants.W_OK), !0;
            } catch {
              return !1;
            }
          })(t.opts.fsCache)) throw new Error("directory is not writable!");
        } catch (e) {
          T(t, "Error creating cache directory at ", t.opts.fsCache, e), t.opts.fsCache = !1;
        }
      }
      function me(t, e) {
        let s = xr(t, e, () => {
          const i = t.opts.transform({ ...t.opts.transformOptions, babel: { ...t.opts.sourceMaps ? { sourceFileName: e.filename, sourceMaps: "inline" } : {}, ...t.opts.transformOptions?.babel }, interopDefault: t.opts.interopDefault, ...e });
          return i.error && t.opts.debug && T(t, i.error), i.code;
        });
        return s.startsWith("#!") && (s = "// " + s), s;
      }
      function ge(t, e, s = {}) {
        const i = s.id || (s.filename ? ts(s.filename) : `_jitiEval.${s.ext || (s.async ? "mjs" : "js")}`), r = s.filename || At(t, i, { async: s.async }), a = s.ext || Xe(r), o = s.cache || t.parentCache || {}, h = /\.[cm]?tsx?$/.test(a), c = a === ".mjs" || a === ".js" && (function(I) {
          for (; I && I !== "." && I !== "/"; ) {
            I = tt(I, "..");
            try {
              const ct = (0, O.readFileSync)(tt(I, "package.json"), "utf8");
              try {
                return JSON.parse(ct);
              } catch {
              }
              break;
            } catch {
            }
          }
        })(r)?.type === "module", p = a === ".cjs", l = s.forceTranspile ?? (!p && !(c && s.async) && (h || c || t.isTransformRe.test(r) || zi(e))), f = Vs.performance.now();
        if (l) {
          e = me(t, { filename: r, source: e, ts: h, async: s.async ?? !1, jsx: t.opts.jsx });
          const I = Math.round(1e3 * (Vs.performance.now() - f)) / 1e3;
          T(t, "[transpile]", s.async ? "[esm]" : "[cjs]", r, `(${I}ms)`);
        } else {
          if (T(t, "[native]", s.async ? "[import]" : "[require]", r), s.async) return Promise.resolve(ht(t, r, s.async)).catch((I) => (T(t, "Native import error:", I), T(t, "[fallback]", r), ge(t, e, { ...s, forceTranspile: !0 })));
          try {
            return ht(t, r, s.async);
          } catch (I) {
            T(t, "Native require error:", I), T(t, "[fallback]", r), e = me(t, { filename: r, source: e, ts: h, async: s.async ?? !1, jsx: t.opts.jsx });
          }
        }
        const u = new ft.Module(r);
        u.filename = r, t.parentModule && (u.parent = t.parentModule, Array.isArray(t.parentModule.children) && !t.parentModule.children.includes(u) && t.parentModule.children.push(u));
        const v = Us(r, t.opts, { parentModule: u, parentCache: o, nativeImport: t.nativeImport, onError: t.onError, createRequire: t.createRequire }, !0);
        let k;
        u.require = v, u.path = Ut(r), u.paths = ft.Module._nodeModulePaths(u.path), o[r] = u, t.opts.moduleCache && (t.nativeRequire.cache[r] = u);
        const y = (function(I, ct) {
          return `(${ct?.async ? "async " : ""}function (exports, require, module, __filename, __dirname, jitiImport, jitiESMResolve) { ${I}
});`;
        })(e, { async: s.async });
        try {
          k = mr().runInThisContext(y, { filename: r, lineOffset: 0, displayErrors: !1 });
        } catch (I) {
          I.name === "SyntaxError" && s.async && t.nativeImport ? (T(t, "[esm]", "[import]", "[fallback]", r), k = (function(ct, xe) {
            const ve = `data:text/javascript;base64,${Buffer.from(`export default ${ct}`).toString("base64")}`;
            return (...ye) => xe(ve).then((Wt) => Wt.default(...ye));
          })(y, t.nativeImport)) : (t.opts.moduleCache && delete t.nativeRequire.cache[r], t.onError(I));
        }
        let C;
        try {
          C = k(u.exports, u.require, u, u.filename, Ut(u.filename), v.import, v.esmResolve);
        } catch (I) {
          t.opts.moduleCache && delete t.nativeRequire.cache[r], t.onError(I);
        }
        function S() {
          if (u.exports && u.exports.__JITI_ERROR__) {
            const { filename: I, line: ct, column: xe, code: ve, message: ye } = u.exports.__JITI_ERROR__, Wt = new Error(`${ve}: ${ye} 
 ${`${I}:${ct}:${xe}`}`);
            Error.captureStackTrace(Wt, de), t.onError(Wt);
          }
          return u.loaded = !0, ot(t, u.exports);
        }
        return s.async ? Promise.resolve(C).then(S) : S();
      }
      const yr = (0, A.platform)() === "win32";
      function Us(t, e = {}, s, i = !1) {
        const r = i ? e : (function(y) {
          const C = { fsCache: Y("JITI_FS_CACHE", Y("JITI_CACHE", !0)), rebuildFsCache: Y("JITI_REBUILD_FS_CACHE", !1), moduleCache: Y("JITI_MODULE_CACHE", Y("JITI_REQUIRE_CACHE", !0)), debug: Y("JITI_DEBUG", !1), sourceMaps: Y("JITI_SOURCE_MAPS", !1), interopDefault: Y("JITI_INTEROP_DEFAULT", !0), extensions: _t("JITI_EXTENSIONS", [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".mtsx", ".ctsx"]), alias: _t("JITI_ALIAS", {}), nativeModules: _t("JITI_NATIVE_MODULES", []), transformModules: _t("JITI_TRANSFORM_MODULES", []), tryNative: _t("JITI_TRY_NATIVE", "Bun" in globalThis), jsx: Y("JITI_JSX", !1) };
          C.jsx && C.extensions.push(".jsx", ".tsx");
          const S = {};
          return y.cache !== void 0 && (S.fsCache = y.cache), y.requireCache !== void 0 && (S.moduleCache = y.requireCache), { ...C, ...S, ...y };
        })(e), a = r.alias && Object.keys(r.alias).length > 0 ? Cs(r.alias || {}) : void 0, o = ["typescript", "jiti", ...r.nativeModules || []], h = new RegExp(`node_modules/(${o.map((y) => bs(y)).join("|")})/`), c = [...r.transformModules || []], p = new RegExp(`node_modules/(${c.map((y) => bs(y)).join("|")})/`);
        t || (t = process.cwd()), !i && Ps(t) && (t = tt(t, "_index.js"));
        const l = gt(t), f = [...r.extensions].filter((y) => y !== ".js"), u = s.createRequire(yr ? t.replace(/\//g, "\\") : t), v = { filename: t, url: l, opts: r, alias: a, nativeModules: o, transformModules: c, isNativeRe: h, isTransformRe: p, additionalExts: f, nativeRequire: u, onError: s.onError, parentModule: s.parentModule, parentCache: s.parentCache, nativeImport: s.nativeImport, createRequire: s.createRequire };
        return i || T(v, "[init]", ...[["version:", Qi.rE], ["module-cache:", r.moduleCache], ["fs-cache:", r.fsCache], ["rebuild-fs-cache:", r.rebuildFsCache], ["interop-defaults:", r.interopDefault]].flat()), i || vr(v), Object.assign(function(y) {
          return de(v, y, { async: !1 });
        }, { cache: r.moduleCache ? u.cache : /* @__PURE__ */ Object.create(null), extensions: u.extensions, main: u.main, options: r, resolve: Object.assign(function(y) {
          return At(v, y, { async: !1 });
        }, { paths: u.resolve.paths }), transform: (y) => me(v, y), evalModule: (y, C) => ge(v, y, C), async import(y, C) {
          const S = await de(v, y, { ...C, async: !0 });
          return C?.default ? S?.default ?? S : S;
        }, esmResolve(y, C) {
          typeof C == "string" && (C = { parentURL: C });
          const S = At(v, y, { parentURL: l, ...C, async: !0 });
          return !S || typeof S != "string" || S.startsWith("file://") ? S : gt(S);
        } });
      }
    })(), _e.exports = be.default;
  })()), _e.exports;
}
var Dr = Or();
const Vr = /* @__PURE__ */ Er(Dr);
function Ur(z) {
  throw z;
}
const Mr = (z) => import(z);
let Ee;
function jr(...z) {
  return Ee || (Ee = js(import.meta.url)("../dist/babel.cjs")), Ee(...z);
}
function tn(z, it = {}) {
  return it.transform || (it = { ...it, transform: jr }), Vr(z, it, {
    onError: Ur,
    nativeImport: Mr,
    createRequire: js
  });
}
export {
  tn as createJiti,
  tn as default
};
