import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const PLAYER_VISIBLE_TAG = "playerVisible";
const PLAYER_VISIBLE_BOUNDARY_ROOTS = Object.freeze([
  ["src/application/presentation.ts", "PresentationFrame"],
  ["src/application/presentation.ts", "PresentationPort"],
  ["src/browser/completed-run-presentation.ts", "CompletedRunPresentation"],
  ["src/browser/gameplay-session.ts", "BrowserDispatchResult"],
  ["src/application/sound.ts", "SoundPort"],
  ["src/application/simulation.ts", "PlayerAgent"],
  ["src/domain/contracts.ts", "GameEvent"],
  ["src/domain/contracts.ts", "GameObservation"],
]);

function readProjectArgument(arguments_) {
  const projectIndex = arguments_.indexOf("--project");

  if (projectIndex === -1 || !arguments_[projectIndex + 1]) {
    return "tsconfig.json";
  }

  return arguments_[projectIndex + 1];
}

function formatDiagnostics(diagnostics, currentDirectory) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => currentDirectory,
    getNewLine: () => "\n",
  });
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
  return declaration.name?.text ?? "<anonymous>";
}

function isDependencySourceFile(sourceFile) {
  return sourceFile.fileName.split(/[\\/]/).includes("node_modules");
}

export function checkPublicContracts({
  cwd = process.cwd(),
  project = "tsconfig.json",
} = {}) {
  const currentDirectory = path.resolve(cwd);
  const projectPath = path.resolve(currentDirectory, project);
  const projectDirectory = path.dirname(projectPath);
  const configResult = ts.readConfigFile(projectPath, ts.sys.readFile);

  if (configResult.error) {
    return {
      diagnostics: formatDiagnostics([configResult.error], currentDirectory),
      exitCode: 1,
    };
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    projectDirectory,
    undefined,
    projectPath,
  );

  if (parsedConfig.errors.length > 0) {
    return {
      diagnostics: formatDiagnostics(parsedConfig.errors, currentDirectory),
      exitCode: 1,
    };
  }

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });
  const checker = program.getTypeChecker();
  const projectSourceFiles = new Set(
    program
      .getSourceFiles()
      .filter((sourceFile) => !isDependencySourceFile(sourceFile)),
  );

  function resolveMergedDeclarations(declaration) {
    const symbol = declaration.name
      ? checker.getSymbolAtLocation(declaration.name)
      : undefined;

    return (symbol?.declarations ?? [declaration]).filter(
      (candidate) =>
        isContractDeclaration(candidate) &&
        projectSourceFiles.has(candidate.getSourceFile()),
    );
  }

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
        hasJSDocTag(statement, PLAYER_VISIBLE_TAG)
      ) {
        playerVisibleDeclarations.push(statement);
      }
    }
  }

  for (const [relativeFile, declaration] of PLAYER_VISIBLE_BOUNDARY_ROOTS) {
    const sourceFile = program.getSourceFile(
      path.resolve(projectDirectory, relativeFile),
    );
    const rootDeclaration = sourceFile?.statements.find(
      (statement) =>
        isContractDeclaration(statement) &&
        declarationName(statement) === declaration,
    );

    if (
      rootDeclaration &&
      !playerVisibleDeclarations.includes(rootDeclaration)
    ) {
      playerVisibleDeclarations.push(rootDeclaration);
    }
  }

  const violations = [];

  for (const rootDeclaration of playerVisibleDeclarations) {
    const rootDeclarations = resolveMergedDeclarations(rootDeclaration);
    const visited = new Set(rootDeclarations);

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

    for (const declaration of rootDeclarations) {
      inspectDeclaration(declaration, [declarationName(rootDeclaration)]);
    }
  }

  const uniqueViolations = new Map(
    violations.map((violation) => [violation.path.join(" -> "), violation]),
  );
  const diagnostics = [...uniqueViolations.values()]
    .map((violation) => {
      const sourceFile = violation.root.getSourceFile();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        violation.root.getStart(sourceFile),
      );
      const relativeFile = path.relative(currentDirectory, sourceFile.fileName);

      return (
        `${relativeFile}:${line + 1}:${character + 1} ` +
        `Player-visible type reaches an unapproved project type: ` +
        `${violation.path.join(" -> ")}\n`
      );
    })
    .join("");

  return {
    diagnostics,
    exitCode: uniqueViolations.size > 0 ? 1 : 0,
  };
}

function isMainModule() {
  return (
    process.argv[1] !== undefined &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  );
}

if (isMainModule()) {
  const result = checkPublicContracts({
    project: readProjectArgument(process.argv.slice(2)),
  });
  process.stderr.write(result.diagnostics);
  process.exitCode = result.exitCode;
}
