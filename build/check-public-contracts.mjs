import path from "node:path";
import process from "node:process";

import ts from "typescript";

const PLAYER_VISIBLE_TAG = "playerVisible";
const PLAYER_VISIBLE_BOUNDARY_ROOTS = new Set([
  "src/application/presentation.ts#PresentationFrame",
  "src/application/simulation.ts#PlayerAgent",
  "src/domain/contracts.ts#GameEvent",
  "src/domain/contracts.ts#GameObservation",
]);

function readProjectArgument(arguments_) {
  const projectIndex = arguments_.indexOf("--project");

  if (projectIndex === -1 || !arguments_[projectIndex + 1]) {
    return "tsconfig.json";
  }

  return arguments_[projectIndex + 1];
}

function reportDiagnostics(diagnostics, currentDirectory) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => currentDirectory,
      getNewLine: () => "\n",
    }),
  );
}

function hasJSDocTag(declaration, tagName) {
  return ts
    .getJSDocTags(declaration)
    .some((tag) => tag.tagName.text === tagName);
}

function isContractDeclaration(node) {
  return (
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node)
  );
}

function declarationName(declaration) {
  return declaration.name?.getText() ?? "<anonymous>";
}

function declarationKey(declaration, projectDirectory) {
  const relativeFile = path
    .relative(projectDirectory, declaration.getSourceFile().fileName)
    .split(path.sep)
    .join("/");

  return `${relativeFile}#${declarationName(declaration)}`;
}

const projectArgument = readProjectArgument(process.argv.slice(2));
const projectPath = path.resolve(process.cwd(), projectArgument);
const projectDirectory = path.dirname(projectPath);
const configResult = ts.readConfigFile(projectPath, ts.sys.readFile);

if (configResult.error) {
  reportDiagnostics([configResult.error], process.cwd());
  process.exitCode = 1;
} else {
  const parsedConfig = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    projectDirectory,
    undefined,
    projectPath,
  );

  if (parsedConfig.errors.length > 0) {
    reportDiagnostics(parsedConfig.errors, process.cwd());
    process.exitCode = 1;
  } else {
    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
    });
    const checker = program.getTypeChecker();
    const projectSourceFiles = new Set(
      program
        .getSourceFiles()
        .filter(
          (sourceFile) =>
            !sourceFile.fileName.includes(`${path.sep}node_modules${path.sep}`),
        ),
    );

    function resolveDeclarations(typeName) {
      let symbol = checker.getSymbolAtLocation(typeName);

      if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        symbol = checker.getAliasedSymbol(symbol);
      }

      return (symbol?.declarations ?? []).filter(
        (declaration) =>
          isContractDeclaration(declaration) &&
          projectSourceFiles.has(declaration.getSourceFile()),
      );
    }

    const playerVisibleDeclarations = [];

    for (const sourceFile of projectSourceFiles) {
      for (const statement of sourceFile.statements) {
        if (
          isContractDeclaration(statement) &&
          (hasJSDocTag(statement, PLAYER_VISIBLE_TAG) ||
            PLAYER_VISIBLE_BOUNDARY_ROOTS.has(
              declarationKey(statement, projectDirectory),
            ))
        ) {
          playerVisibleDeclarations.push(statement);
        }
      }
    }

    const violations = [];

    for (const rootDeclaration of playerVisibleDeclarations) {
      const visited = new Set([rootDeclaration]);

      function inspectDeclaration(declaration, typePath) {
        function inspectNode(node) {
          let typeName;

          if (ts.isTypeReferenceNode(node)) {
            typeName = node.typeName;
          } else if (ts.isExpressionWithTypeArguments(node)) {
            typeName = node.expression;
          }

          if (typeName) {
            for (const referencedDeclaration of resolveDeclarations(typeName)) {
              const nextPath = [
                ...typePath,
                declarationName(referencedDeclaration),
              ];

              if (!hasJSDocTag(referencedDeclaration, PLAYER_VISIBLE_TAG)) {
                violations.push({
                  path: nextPath,
                  root: rootDeclaration,
                });
              } else if (!visited.has(referencedDeclaration)) {
                visited.add(referencedDeclaration);
                inspectDeclaration(referencedDeclaration, nextPath);
              }
            }
          }

          ts.forEachChild(node, inspectNode);
        }

        ts.forEachChild(declaration, inspectNode);
      }

      inspectDeclaration(rootDeclaration, [declarationName(rootDeclaration)]);
    }

    const uniqueViolations = new Map(
      violations.map((violation) => [violation.path.join(" -> "), violation]),
    );

    for (const violation of uniqueViolations.values()) {
      const sourceFile = violation.root.getSourceFile();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        violation.root.getStart(sourceFile),
      );
      const relativeFile = path.relative(process.cwd(), sourceFile.fileName);

      process.stderr.write(
        `${relativeFile}:${line + 1}:${character + 1} ` +
          `Player-visible type reaches an unapproved project type: ` +
          `${violation.path.join(" -> ")}\n`,
      );
    }

    if (uniqueViolations.size > 0) {
      process.exitCode = 1;
    }
  }
}
