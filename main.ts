/// <reference path="typings/node/node.d.ts" />
// Use HEAD version of typescript, installed by npm
/// <reference path="node_modules/typescript/bin/typescript.d.ts" />

import ts = require("typescript");

export function translateProgram(program: ts.Program): string {
  var result: string = "";
  program.getSourceFiles()
      .filter((sourceFile: ts.SourceFile) => sourceFile.fileName.indexOf(".d.ts") < 0)
      .forEach(emitDart);
  return result;

  function emit(str: string) {
    result += ' ';
    result += str;
  }

  function visitEach(nodes) {
    nodes.forEach(visit);
  }

  function visitList(nodes: ts.NodeArray<ts.Node>) {
    for (var i = 0; i < nodes.length; i++) {
      visit(nodes[i]);
      if (i < nodes.length - 1) emit(',');
    }
  }

  function visitFunctionLike(fn: ts.FunctionLikeDeclaration) {
    emit('(');
    visitList(fn.parameters);
    emit(')');
    visit(fn.body);
  }

  function visitCall(c: ts.CallExpression) {
    visit(c.expression);
    emit('(');
    visitList(c.arguments);
    emit(')');
  }

  function reportError(n: ts.Node, message: string) {
    var file = n.getSourceFile();
    var start = n.getStart();
    var pos = file.getLineAndCharacterOfPosition(start);
    throw new Error(`${file.fileName}:${pos.line}:${pos.character}: ${message}`);
  }

  // Comments attach to all following AST nodes before the next 'physical' token. Track the earliest
  // offset to avoid printing comments multiple times.
  // TODO(martinprobst): Refactor this.
  var lastCommentIdx;

  function visit(node: ts.Node) {
    // console.log(`Node kind: ${node.kind} ${node.getText()}`);
    var comments = ts.getLeadingCommentRanges(node.getSourceFile().text, node.getFullStart());
    if (comments) {
      comments.forEach((c) => {
        if (c.pos <= lastCommentIdx) return;
        lastCommentIdx = c.pos;
        var text = node.getSourceFile().text.substring(c.pos, c.end);
        emit(text);
        if (c.hasTrailingNewLine) result += '\n';
      });
    }

    switch (node.kind) {
      case ts.SyntaxKind.SourceFile:
      case ts.SyntaxKind.EndOfFileToken:
        ts.forEachChild(node, visit);
        break;

      case ts.SyntaxKind.VariableDeclarationList:
        var varDeclList = <ts.VariableDeclarationList>node;
        visitEach(varDeclList.declarations);
        break;

      case ts.SyntaxKind.VariableDeclaration:
        var varDecl = <ts.VariableDeclaration>node;
        if (varDecl.type) {
          visit(varDecl.type);
        } else {
          emit('var');
        }
        visit(varDecl.name);
        if (varDecl.initializer) {
          emit('=');
          visit(varDecl.initializer);
        }
        break;

      case ts.SyntaxKind.NumberKeyword:
        emit('num');
        break;
      case ts.SyntaxKind.StringKeyword:
        emit('String');
        break;
      case ts.SyntaxKind.VoidKeyword:
        emit('void');
        break;

      case ts.SyntaxKind.ParenthesizedExpression:
        var parenExpr = <ts.ParenthesizedExpression>node;
        emit('(');
        visit(parenExpr.expression);
        emit(')');
        break;

      case ts.SyntaxKind.VariableStatement:
        ts.forEachChild(node, visit);
        emit(';\n');
        break;
      case ts.SyntaxKind.ExpressionStatement:
        var expr = <ts.ExpressionStatement>node;
        visit(expr.expression);
        emit(';');
        break;
      case ts.SyntaxKind.SwitchStatement:
        var switchStmt = <ts.SwitchStatement>node;
        emit('switch (');
        visit(switchStmt.expression);
        emit(') {');
        visitEach(switchStmt.clauses);
        emit('}');
        break;
      case ts.SyntaxKind.CaseClause:
        var caseClause = <ts.CaseClause>node;
        emit('case');
        visit(caseClause.expression);
        emit(':');
        visitEach(caseClause.statements);
        break;
      case ts.SyntaxKind.DefaultClause:
        emit('default :');
        visitEach((<ts.DefaultClause>node).statements);
        break;
      case ts.SyntaxKind.IfStatement:
        var ifStmt = <ts.IfStatement>node;
        emit('if (');
        visit(ifStmt.expression);
        emit(')');
        visit(ifStmt.thenStatement);
        if (ifStmt.elseStatement) {
          emit('else');
          visit(ifStmt.elseStatement);
        }
        break;

      case ts.SyntaxKind.ForStatement:
        var forStmt = <ts.ForStatement>node;
        emit('for (');
        if (forStmt.initializer) visit(forStmt.initializer);
        emit(';');
        if (forStmt.condition) visit(forStmt.condition);
        emit(';');
        if (forStmt.iterator) visit(forStmt.iterator);
        emit(')');
        visit(forStmt.statement);
        break;
      case ts.SyntaxKind.ForInStatement:
        // TODO(martinprobst): Dart's for-in loops actually have different semantics, they are more
        // like for-of loops, iterating over collections.
        var forInStmt = <ts.ForInStatement>node;
        emit ('for (');
        if (forInStmt.initializer) visit(forInStmt.initializer);
        emit('in');
        visit(forInStmt.expression);
        emit(')');
        visit(forInStmt.statement);
        break;
      case ts.SyntaxKind.WhileStatement:
        var whileStmt = <ts.WhileStatement>node;
        emit('while (');
        visit(whileStmt.expression);
        emit(')');
        visit(whileStmt.statement);
        break;
      case ts.SyntaxKind.DoStatement:
        var doStmt = <ts.DoStatement>node;
        emit('do');
        visit(doStmt.statement);
        emit('while (');
        visit(doStmt.expression);
        emit(') ;');
        break;

      case ts.SyntaxKind.BreakStatement:
        emit('break ;');
        break;

      // Literals.
      case ts.SyntaxKind.NumericLiteral:
        var sLit = <ts.LiteralExpression>node;
        emit(sLit.getText());
        break;
      case ts.SyntaxKind.StringLiteral:
        var sLit = <ts.LiteralExpression>node;
        emit(JSON.stringify(sLit.text));
        break;
      case ts.SyntaxKind.TrueKeyword:
        emit('true');
        break;
      case ts.SyntaxKind.FalseKeyword:
        emit('false');
        break;
      case ts.SyntaxKind.NullKeyword:
        emit('null');
        break;
      case ts.SyntaxKind.RegularExpressionLiteral:
        emit((<ts.LiteralExpression>node).text);
        break;
      case ts.SyntaxKind.ThisKeyword:
        emit('this');
        break;

      case ts.SyntaxKind.PropertyAccessExpression:
        var propAccess = <ts.PropertyAccessExpression>node;
        visit(propAccess.expression);
        emit('.');
        visit(propAccess.name);
        break;
      case ts.SyntaxKind.ElementAccessExpression:
        var elemAccess = <ts.ElementAccessExpression>node;
        visit(elemAccess.expression);
        emit('[');
        visit(elemAccess.argumentExpression);
        emit(']');
        break;
      case ts.SyntaxKind.NewExpression:
        emit('new');
        visitCall(<ts.NewExpression>node);
        break;
      case ts.SyntaxKind.CallExpression:
        visitCall(<ts.CallExpression>node);
        break;
      case ts.SyntaxKind.BinaryExpression:
        var binExpr = <ts.BinaryExpression>node;
        visit(binExpr.left);
        emit(ts.tokenToString(binExpr.operatorToken.kind));
        visit(binExpr.right);
        break;
      case ts.SyntaxKind.PrefixUnaryExpression:
        var prefixUnary = <ts.PrefixUnaryExpression>node;
        emit(ts.tokenToString(prefixUnary.operator));
        visit(prefixUnary.operand);
        break;
      case ts.SyntaxKind.PostfixUnaryExpression:
        var postfixUnary = <ts.PostfixUnaryExpression>node;
        visit(postfixUnary.operand);
        emit(ts.tokenToString(postfixUnary.operator));
        break;
      case ts.SyntaxKind.ConditionalExpression:
        var conditional = <ts.ConditionalExpression>node;
        visit(conditional.condition);
        emit('?');
        visit(conditional.whenTrue);
        emit(':');
        visit(conditional.whenFalse);
        break;
      case ts.SyntaxKind.DeleteExpression:
        reportError(node, 'delete operator is unsupported');
        break;
      case ts.SyntaxKind.VoidExpression:
        reportError(node, 'void operator is unsupported');
        break;
      case ts.SyntaxKind.TypeOfExpression:
        reportError(node, 'typeof operator is unsupported');
        break;

      case ts.SyntaxKind.Identifier:
        emit(node.getText());
        break;

      case ts.SyntaxKind.TypeReference:
        var typeRef = <ts.TypeReferenceNode>node;
        visit(typeRef.typeName);
        if (typeRef.typeArguments) {
          emit('<');
          visitList(typeRef.typeArguments);
          emit('>');
        }
        break;
      case ts.SyntaxKind.TypeParameter:
        var typeParam = <ts.TypeParameterDeclaration>node;
        visit(typeParam.name);
        if (typeParam.constraint) {
          emit('extends');
          visit(typeParam.constraint);
        }
        break;

      case ts.SyntaxKind.ClassDeclaration:
        var classDecl = <ts.ClassDeclaration>node;
        emit('class');
        visit(classDecl.name);
        if (classDecl.typeParameters) {
          emit('<');
          visitList(classDecl.typeParameters);
          emit('>');
        }
        if (classDecl.heritageClauses) {
          visitEach(classDecl.heritageClauses);
        }

        if (classDecl.members) {
          emit('{');
          visitEach(classDecl.members);
          emit('}');
        }
        break;

      case ts.SyntaxKind.HeritageClause:
        var heritageClause = <ts.HeritageClause>node;
        if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword) {
          emit('extends');
        } else {
          emit('implements');
        }
        // Can only have one member for extends clauses.
        visitList(heritageClause.types);
        break;

      case ts.SyntaxKind.Constructor:
        var ctorDecl = <ts.ConstructorDeclaration>node;
        // Find containing class name.
        var className;
        for (var parent = ctorDecl.parent; parent; parent = parent.parent) {
          if (parent.kind == ts.SyntaxKind.ClassDeclaration) {
            className = (<ts.ClassDeclaration>parent).name;
            break;
          }
        }
        if (!className) reportError(ctorDecl, 'cannot find outer class node');
        visit(className);
        visitFunctionLike(ctorDecl);
        break;

      case ts.SyntaxKind.PropertyDeclaration:
        var propertyDecl = <ts.PropertyDeclaration>node;
        visit(propertyDecl.type);
        visit(propertyDecl.name);
        if (propertyDecl.initializer) {
          emit('=');
          visit(propertyDecl.initializer);
        }
        emit(';');
        break;

      case ts.SyntaxKind.MethodDeclaration:
        var methodDecl = <ts.MethodDeclaration>node;
        if (methodDecl.type) visit(methodDecl.type);
        visit(methodDecl.name);
        visitFunctionLike(methodDecl);
        break;

      case ts.SyntaxKind.FunctionDeclaration:
        var funcDecl = <ts.FunctionDeclaration>node;
        if (funcDecl.typeParameters) reportError(node, 'generic functions are unsupported');
        if (funcDecl.type) visit(funcDecl.type);
        visit(funcDecl.name);
        visitFunctionLike(funcDecl);
        break;

      case ts.SyntaxKind.Parameter:
        var paramDecl = <ts.ParameterDeclaration>node;
        if (paramDecl.dotDotDotToken) reportError(node, 'rest parameters are unsupported');
        if (paramDecl.initializer) emit('[');
        if (paramDecl.type) visit(paramDecl.type);
        visit(paramDecl.name);
        if (paramDecl.initializer) {
          emit('=');
          visit(paramDecl.initializer);
          emit(']');
        }
        break;

      case ts.SyntaxKind.ReturnStatement:
        emit('return');
        visit((<ts.ReturnStatement>node).expression);
        emit(';');
        break;

      case ts.SyntaxKind.Block:
        emit('{');
        visitEach((<ts.Block>node).statements);
        emit('}');
        break;

      default:
        reportError(node, "Unsupported node type " + (<any>ts).SyntaxKind[node.kind]);
        break;
    }
  }
  function emitDart(sourceFile: ts.SourceFile) {
    lastCommentIdx = -1;
    visit(sourceFile);
  }
}

export function translateFiles(fileNames: string[]): string {
  var options: ts.CompilerOptions = { target: ts.ScriptTarget.ES6, module: ts.ModuleKind.CommonJS };
  var host = ts.createCompilerHost(options);
  var program = ts.createProgram(fileNames, options, host);
  return translateProgram(program);
}

// CLI entry point
translateFiles(process.argv.slice(2));
