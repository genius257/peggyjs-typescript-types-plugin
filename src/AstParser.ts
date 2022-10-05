import { ast } from "peggy";

type Label = {
    name: string;
    types: Array<string>;
};

class Result {
    public types: Array<string> = [];
    public labels: Array<Label> = [];
    public code: string = '';

    public toString(): string {
        /*
        if (this.code === "") {
            return 'return null as unknown as '+this.types.join('|')+';'
        }
        */
        //NOTE: using let instead of const, to avoid error "'const' declarations must be initialized."
        let labels = this.labels.map(label => 'let '+label.name+':'+label.types.join('|')).join(';');
        if (labels !== "") {labels+=';';}
        return labels+this.code;
    }
}

export default class AstParser {
    parseRule(rule: ast.Rule, result:Result = new Result()) {
        let sRule: string = "export type "+rule.name+'=ReturnType<typeof peg$parse'+rule.name+'>;'+"\n";
        sRule += 'export function peg$parse'+rule.name+'()';
        if (rule.expression.type === "named") {
            this.parseNamed(rule.expression, result);
        } else {
            this.parseExpression(rule.expression, result);
        }
        if (result.code === "") {
            sRule += ':'+result.types.join('|');
        }
        sRule += '{';
        sRule += result.toString();
        return sRule + '};'+"\n";
    }

    parseNamed(named: ast.Named, result: Result): Result {
        //NOTE: currently we do not procces the named information, so we just pass it along.
        this.parseExpression(named.expression, result);
        return result;
    }

    parseExpression(expression: ast.Expression, result: Result): Result {
        switch (expression.type)
        {
            case 'action':
                this.parseAction(expression, result);
            break;
            case 'any':
                this.parseAny(expression, result);
                break
            case 'choice':
                this.parseChoice(expression, result);
                break;
            case 'class':
                this.parseClass(expression, result);
                break;
            case 'group':
                this.parseGroup(expression, result);
                break;
            case 'labeled':
                this.parseLabeled(expression, result);
                break;
            case 'literal':
                this.parseLiteral(expression, result);
                break;
            case 'one_or_more':
                this.parseOneOrMore(expression, result);
                break;
            case 'optional':
                this.parseOptional(expression, result);
                break;
            case 'rule_ref':
                this.parseRuleRef(expression, result);
                break;
            case 'semantic_and':
                this.parseSemanticAnd(expression, result);
                break;
            case 'semantic_not':
                this.parseSemanticNot(expression, result);
                break;
            case 'sequence':
                this.parseSequence(expression, result);
                break;
            case 'simple_and':
                this.parseSimpleAnd(expression, result);
                break;
            case 'simple_not':
                this.parseSimpleNot(expression, result);
                break;
            case 'text':
                this.parseText(expression, result);
                break;
            case 'zero_or_more':
                this.parseZeroOrMore(expression, result);
                break;
            default:
                //@ts-ignore
                throw new Error("expression type not supported: "+expression.type);
        }

        return result;
    }
    // ! { predicate }
    parseSemanticNot(expression: ast.SemanticPredicate, result: Result) {
        //FIXME: validate return value
        result.types.push('undefined');//TODO: if no match does this return void?
    }
    // & { predicate }
    parseSemanticAnd(expression: ast.SemanticPredicate, result: Result) {
        //FIXME: validate return value
        result.types.push('undefined');//TODO: if no match does this return void?
    }
    parseAny(expression: ast.Any, result: Result) {
        result.types.push("string");
    }
    parseZeroOrMore(expression: ast.Suffixed, result: Result) {
        const _result = new Result();
        this.parseExpression(expression.expression, _result);
        result.labels.push(..._result.labels);
        //TODO: verify that ignoring code attribute is not a problem
        //result.types.push(..._result.types.map((type: string) => type+'?'))
        result.types.push('Array<' + _result.types.join('|') + '|never>');
    }
    parseText(expression: ast.Prefixed, result: Result) {
        //FIXME parse sub expression to allow labels ref?
        result.types.push('string');
    }
    // ! expression
    parseSimpleNot(expression: ast.Prefixed, result: Result) {
        //FIXME parse sub expression to allow labels ref?
        result.types.push('undefined?');
    }
    // & expression
    parseSimpleAnd(expression: ast.Prefixed, result: Result) {
        //FIXME parse sub expression to allow labels ref?
        result.types.push('undefined?');
    }
    parseSequence(expression: ast.Sequence, result: Result) {
        expression.elements.forEach((element: ast.Element) => this.parseExpression(element, result));
    }
    parseRuleRef(expression: ast.RuleReference, result: Result) {
        result.types.push(expression.name);
    }
    parseOptional(expression: ast.Suffixed, result: Result) {
        const _result = new Result();
        this.parseExpression(expression.expression, _result);
        result.labels.push(..._result.labels);
        result.types.push('('+_result.types.join('|')+')|never');
    }
    parseOneOrMore(expression: ast.Suffixed, result: Result) {
        const _result = new Result();
        this.parseExpression(expression.expression, _result);
        result.labels.push(..._result.labels);
        //TODO: verify that ignoring code attribute is not a problem
        //result.types.push(..._result.types.map((type: string) => type+'?'))
        result.types.push('Array<' + _result.types.join('|') + '>');
    }
    parseLiteral(expression: ast.Literal, result: Result) {
        result.types.push(JSON.stringify(expression.value));
        //result.types.push(typeof expression.value);
    }
    parseLabeled(expression: ast.Labeled, result: Result) {
        if(expression.label === null) {
            return this.parseExpression(expression.expression, result);
        }
        const label: Label = {
            name: expression.label,
            types: [],
        };
        const _result = this.parseExpression(expression.expression, new Result());
        label.types.push(..._result.types);
        result.labels.push(label);
    }
    parseGroup(expression: ast.Group, result: Result) {
        const _result = new Result();
        this.parseExpression(expression.expression, _result);
        result.labels.push(..._result.labels);
        result.types.push('('+_result.types.join('|')+')')
    }
    parseClass(expression: ast.CharacterClass, result: Result) {
        if (expression.inverted) {
            result.types.push('string');
        } else {
            result.types.push('('+expression.parts.map(part => JSON.stringify(part)).join('|')+')');
        }
        //NOTE: we just take the basic type(s) available for now.
        //result.types.push(...expression.parts.map(part => typeof part).filter((predicate, index, array) => array.indexOf(predicate) === index));
    }

    parseChoice(expression: ast.Choice, result: Result) {
        const choices:Array<Array<string>> = [];
        expression.alternatives.forEach((alternative: ast.Alternative) => {
            const _result = new Result();
            this.parseExpression(alternative, _result);
            result.labels.push(..._result.labels);
            choices.push(_result.types);
        });
        result.types.push(...choices.map(choice => '('+choice.join('|')+')'));
    }

    public parseAction(expression: ast.Action, result: Result) {
        result.code = expression.code;
        this.parseExpression(expression.expression, result);
    }
}
