// @ts-check

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;
const FUNC_PATTERN = /\b(?:rgba?|hsla?)\s*\(/i;

// CSS Level 4 named colors, minus ambiguous words that collide with common
// non-color identifiers ("red", "blue" etc. are still caught — they are
// exactly the kind of drift this rule exists to catch).
const NAMED_COLORS = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige",
  "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
  "burlywood", "cadetblue", "chartreuse", "chocolate", "coral",
  "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan",
  "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki",
  "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred",
  "darksalmon", "darkseagreen", "darkslateblue", "darkslategray",
  "darkslategrey", "darkturquoise", "darkviolet", "deeppink", "deepskyblue",
  "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite",
  "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod",
  "gray", "green", "greenyellow", "grey", "honeydew", "hotpink", "indianred",
  "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen",
  "lemonchiffon", "lightblue", "lightcoral", "lightcyan",
  "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey",
  "lightpink", "lightsalmon", "lightseagreen", "lightskyblue",
  "lightslategray", "lightslategrey", "lightsteelblue", "lightyellow",
  "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine",
  "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen",
  "mediumslateblue", "mediumspringgreen", "mediumturquoise",
  "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
  "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange",
  "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise",
  "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum",
  "powderblue", "purple", "rebeccapurple", "rosybrown", "royalblue",
  "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna",
  "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow",
  "springgreen", "steelblue", "tan", "teal", "thistle", "tomato",
  "turquoise", "violet", "wheat", "whitesmoke", "yellowgreen",
]);

// Property/attribute names that indicate the string is being used as a raw
// CSS color value (inline styles, CSS-in-JS objects). Bare named colors are
// only flagged in this context, because two of them ("red", "blue") are also
// this codebase's semantic token names and appear constantly as ordinary
// variant strings (e.g. `variant="red"`) that are not color literals at all.
const COLORISH_KEY_PATTERN =
  /^(color|background|backgroundColor|borderColor|outlineColor|fill|stroke|shadowColor|caretColor|textDecorationColor|columnRuleColor)$/i;

function containsColorLiteral(value) {
  if (typeof value !== "string") return false;
  if (HEX_PATTERN.test(value)) return true;
  if (FUNC_PATTERN.test(value)) return true;
  return false;
}

function isBareNamedColor(value) {
  if (typeof value !== "string") return false;
  return NAMED_COLORS.has(value.trim().toLowerCase());
}

function parentKeyName(node) {
  const parent = node.parent;
  if (!parent) return null;
  if (parent.type === "JSXAttribute" && parent.name.type === "JSXIdentifier") {
    return parent.name.name;
  }
  if (
    parent.type === "Property" &&
    (parent.key.type === "Identifier" || parent.key.type === "Literal")
  ) {
    return parent.key.type === "Identifier" ? parent.key.name : String(parent.key.value);
  }
  return null;
}

function isInColorishContext(node) {
  const key = parentKeyName(node);
  return key !== null && COLORISH_KEY_PATTERN.test(key);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow color literals (hex, rgb()/rgba()/hsl()/hsla(), CSS named colors) outside app/tokens.css. Use design tokens instead.",
    },
    schema: [],
    messages: {
      colorLiteral:
        "Color literal '{{value}}' is not allowed outside app/tokens.css. Use a design token instead.",
      namedColor:
        "'{{value}}' looks like a CSS named color and is not allowed outside app/tokens.css. Use a design token instead.",
    },
  },
  create(context) {
    function checkString(node, rawValue) {
      if (typeof rawValue !== "string") return;
      if (containsColorLiteral(rawValue)) {
        context.report({ node, messageId: "colorLiteral", data: { value: rawValue } });
        return;
      }
      if (isBareNamedColor(rawValue) && isInColorishContext(node)) {
        context.report({ node, messageId: "namedColor", data: { value: rawValue } });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") {
          checkString(node, node.value);
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkString(node, quasi.value.raw);
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  rules: {
    "no-color-literals": rule,
  },
};

export default plugin;
