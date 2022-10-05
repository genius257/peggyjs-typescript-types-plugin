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

            ts += ast.initializer?.code;

            ast.rules.forEach((rule: ast.Rule, index: number, array: ast.Rule[]) => {
                ts += astParser.parseRule(rule).toString();
            });

            // @ts-ignore
            ast.code.ts = ts;
        });
    }
} as Plugin;
