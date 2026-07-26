import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.agents',
  '.superpowers',
  '.vscode',
  '.specify',
  'coverage'
]);

const nodes = [];
const edges = [];
const nodeSet = new Set();

function getCategory(filePath) {
  if (filePath.startsWith('apps/web')) return 'web-app';
  if (filePath.startsWith('apps/api')) return 'api-app';
  if (filePath.startsWith('packages/database')) return 'database-pkg';
  if (filePath.startsWith('packages/ui')) return 'ui-pkg';
  if (filePath.startsWith('packages/types')) return 'types-pkg';
  if (filePath.startsWith('packages/config')) return 'config-pkg';
  if (filePath.startsWith('docs') || filePath.startsWith('documents')) return 'docs';
  return 'root';
}

function scanDir(dirPath, parentId = null) {
  const relPath = path.relative(rootDir, dirPath).replace(/\\/g, '/');
  const dirName = path.basename(dirPath);
  const id = relPath === '' ? 'root' : relPath;

  if (!nodeSet.has(id)) {
    nodeSet.add(id);
    nodes.push({
      data: {
        id,
        label: dirName || 'petiatrics',
        type: relPath === '' ? 'root' : 'folder',
        category: getCategory(relPath),
        path: relPath
      }
    });
  }

  if (parentId) {
    edges.push({
      data: {
        id: `tree_${parentId}_to_${id}`,
        source: parentId,
        target: id,
        kind: 'tree'
      }
    });
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const childRelPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        scanDir(fullPath, id);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.ts', '.tsx', '.json', '.md', '.html', '.css', '.prisma', '.js', '.mjs'].includes(ext)) {
          if (!nodeSet.has(childRelPath)) {
            nodeSet.add(childRelPath);
            nodes.push({
              data: {
                id: childRelPath,
                label: entry.name,
                type: 'file',
                category: getCategory(childRelPath),
                ext: ext.slice(1),
                path: childRelPath
              }
            });
          }

          edges.push({
            data: {
              id: `tree_${id}_to_${childRelPath}`,
              source: id,
              target: childRelPath,
              kind: 'tree'
            }
          });

          // Scan file imports if JS/TS file
          if (['.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
            scanImports(fullPath, childRelPath);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dirPath}:`, err.message);
  }
}

function scanImports(filePath, fileId) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      let targetId = null;

      if (importPath.startsWith('@petiatrics/')) {
        const pkgName = importPath.replace('@petiatrics/', '');
        targetId = `packages/${pkgName}`;
      } else if (importPath.startsWith('.')) {
        const absoluteImport = path.resolve(path.dirname(filePath), importPath);
        const relImport = path.relative(rootDir, absoluteImport).replace(/\\/g, '/');
        
        // Try common extensions
        for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
          const testPath = relImport + ext;
          if (nodeSet.has(testPath)) {
            targetId = testPath;
            break;
          }
        }
      }

      if (targetId && nodeSet.has(targetId) && targetId !== fileId) {
        edges.push({
          data: {
            id: `import_${fileId}_to_${targetId}`,
            source: fileId,
            target: targetId,
            kind: 'import'
          }
        });
      }
    }
  } catch (e) {
    // Ignore unreadable files
  }
}

console.log('Scanning project directory...');
scanDir(rootDir);

const output = {
  summary: {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    filesCount: nodes.filter(n => n.data.type === 'file').length,
    foldersCount: nodes.filter(n => n.data.type === 'folder' || n.data.type === 'root').length
  },
  nodes,
  edges
};

const outputPath = path.join(rootDir, 'project-graph-data.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`Success! Graph data generated at ${outputPath}`);
console.log(`Summary: ${output.summary.totalNodes} nodes (${output.summary.foldersCount} folders, ${output.summary.filesCount} files), ${output.summary.totalEdges} edges.`);
