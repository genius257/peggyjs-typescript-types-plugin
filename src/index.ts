import { Config, ParserBuildOptions, Plugin, ast, Session, LocationRange } from "peggy"
import AstParser from "./AstParser";

export default {
    use(config: Config, options: ParserBuildOptions): void {
        config.passes.check.push((ast: ast.Grammar, options: ParserBuildOptions, session: Session) => {
            //console.log("config.passes.check");
        });

        config.passes.transform.push((ast: ast.Grammar, options: ParserBuildOptions, session: Session) => {
            //console.log("config.passes.transform");
        });

        config.passes.generate.push((ast: ast.Grammar, options: ParserBuildOptions, session: Session) => {
            //console.log("config.passes.generate");

            //console.log(JSON.stringify(ast));
            const astParser = new AstParser();
            let ts = "";

            ts += 'import { LocationRange } from "peggy";';
            ts += "function text(): string;";
            ts += "function offset(): string;";
            ts += "function range(): LocationRange;";

            ast.rules.forEach((rule: ast.Rule, index: number, array: ast.Rule[]) => {
                ts += astParser.parseRule(rule).toString();
            });

            // @ts-ignore
            ast.code.ts = ts;
        });
    }
} as Plugin;

function extractResultsFromExpression(expression: ast.Named | ast.Expression, results: Array<string> = []): Array<string> {
    switch (expression.type) {
        case 'action':
            results.push(extractResultsFromExpression(expression.expression).join(';')+";"+expression.code);
            break;
        case 'any':
            //Do nothing
            break
        case 'choice':
            expression.alternatives.forEach((value: ast.Alternative) => {
                extractResultsFromExpression(value, results);
            });
            break;
        case 'class':
                //TODO: look into more specific string defenitions.
                results.push("string");
            break;
        case 'group':
                results.push("("+extractResultsFromExpression(expression.expression)[0]+")")
            break;
        case 'labeled':
                results.push('const '+expression.label+' = '+extractResultsFromExpression(expression.expression)[0]);
            break;
        case 'literal':
                results.push(expression.value);
            break;
        case 'named':
                results.push('const '+expression.name+' = '+extractResultsFromExpression(expression.expression)[0]);
            break;
        case 'one_or_more':
                //NOTE: not sure if ts can do anything here?
                extractResultsFromExpression(expression.expression, results);
            break;
        case 'optional':
            results.push('('+extractResultsFromExpression(expression.expression)[0]+')?');
            break;
        case 'rule_ref':
            results.push(expression.name);
            break;
        //case 'semantic_and':
            //break;
        //case 'semantic_not':
            //break;
        case 'sequence':
            //FIXME: validate this is correct
            results.push('['+expression.elements.map(element => extractResultsFromExpression(element)[0]).join(',')+']')
            break;
        case 'simple_and':
            results.push('&'+extractResultsFromExpression(expression.expression)[0]);
            break;
        case 'simple_not':
            //TODO: we do nothing for now
            break;
        case 'text':
            results.push('string');
            break;
        case 'zero_or_more':
            results.push('('+extractResultsFromExpression(expression.expression)[0]+')?');
            break;
        default:
            //@ts-ignore
            throw new Error("expression type not supported: "+expression.type);
    }

    return results;
}
