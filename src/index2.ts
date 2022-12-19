import {
    close,
    closeSync,
    fstat,
    open,
    openSync,
    readFileSync,
    writeFileSync
} from "fs";
import * as peggy from "peggy";

const grammar = readFileSync("./arithmetics.pegjs").toString();

const peggyAstGrammar = peggy.parser.parse(grammar);
//console.log(peggyAstGrammar);

//console.log(peggyAstGrammar.rules[0].name, peggyAstGrammar.rules[0].expression);

const file = openSync("./out.ts", "w");

writeFileSync(file, "declare function text(): string;\n");
writeFileSync(file, "declare function offset(): number;\n");
writeFileSync(
    file,
    "declare function range(): {source: any;start: number;end: number;};\n"
);
writeFileSync(
    file,
    "declare function location(): {source: any;start: {offset: any;line: number;column: number;};end: {offset: any;line: number;column: number;};};\n"
);
writeFileSync(file, "declare function expected(description, location):void\n");
writeFileSync(file, "declare function error(message, location?):never\n");

if (
    peggyAstGrammar.topLevelInitializer !== undefined &&
    peggyAstGrammar.topLevelInitializer !== null
) {
    writeFileSync(file, peggyAstGrammar.topLevelInitializer.code);
}

let code = "";
peggyAstGrammar.rules.forEach((rule) => {
    writeFileSync(
        file,
        `export type ${rule.name} = ${typeFromExpression(rule.expression)};\n`
    );
});
writeFileSync(file, code);
closeSync(file);

function typeFromExpression(
    expression: peggy.ast.Named | peggy.ast.Expression,
    labels: { [key: string]: string } = {}
): string {
    const type = expression.type;
    switch (type) {
        case "action":
            const functionName = "$xyz" + Math.round(Math.random() * 1000000);
            typeFromExpression(expression.expression, labels);
            code += `function ${functionName}(${Object.entries(labels)
                .map((label) => `${label[0]}: ${label[1]}`)
                .join(",")}){${expression.code}}\n`;
            return `ReturnType<typeof ${functionName}>`;
        case "any":
            return "string";
        case "choice":
            return expression.alternatives
                .map((alternative) => typeFromExpression(alternative, labels))
                .filter((x) => x !== "")
                .join("|");
        case "class":
            return expression.inverted
                ? "string"
                : expression.parts
                      .flat()
                      .map((part) =>
                          JSON.stringify(part).replace(
                              /[\u007F-\uFFFF]/g,
                              function (chr) {
                                  return (
                                      "\\u" +
                                      (
                                          "0000" +
                                          chr.charCodeAt(0).toString(16)
                                      ).substr(-4)
                                  );
                              }
                          )
                      )
                      .join("|");
        case "group":
            const groupType = typeFromExpression(expression.expression);
            return `(${groupType}|Array<${groupType}>)`; //FIXME: this MAY not be right...
        case "labeled":
            const result = typeFromExpression(expression.expression);
            if (expression.label !== null) {
                labels[expression.label] = result;
            }
            return result;
        case "literal":
            return JSON.stringify(expression.value).replace(
                /[\u007F-\uFFFF]/g,
                function (chr) {
                    return (
                        "\\u" +
                        ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
                    );
                }
            );
        case "named":
            return typeFromExpression(expression.expression, labels);
        case "one_or_more":
            let oneOrMoreType = typeFromExpression(expression.expression);
            return `[${oneOrMoreType}, ...Array<${oneOrMoreType}>]`;
        case "optional":
            return (
                "(" +
                typeFromExpression(expression.expression, labels) +
                ")|null"
            );
        case "rule_ref":
            return expression.name;
        case "semantic_and": // TODO: semantic_and/semantic_not not implemented correctly, as no easy test case could be found when implementing
        case "semantic_not":
            expression.code;
            const functionName2 = "$xyz" + Math.round(Math.random() * 1000000);
            code += `function ${functionName2}(${Object.entries(labels)
                .map((label) => `${label[0]}: ${label[1]}`)
                .join(",")}){${expression.code}}\n`;
            return `ReturnType<typeof ${functionName2}>`;
        case "sequence":
            return (
                "[" +
                expression.elements
                    .map((element) => typeFromExpression(element, labels))
                    .filter((x) => x !== "")
                    .join(",") +
                "]"
            );
        case "simple_and":
            return "undefined";
        case "simple_not":
            return "undefined";
        case "text":
            return "string";
        case "zero_or_more":
            return (
                "Array<" +
                typeFromExpression(expression.expression, labels) +
                ">"
            );
        default:
            exhaustiveMatchingGuard(type);
        //Do nothing for now.
    }
}

function exhaustiveMatchingGuard(_value: never): never {
    throw new Error(`Should not have reached here`);
}
