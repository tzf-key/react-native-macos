// @ts-check

'use strict';

const chalk = require('chalk');
const path = require('path');
const childProcess = require('child_process');
const fs = require('fs');
const {
  appendToExistingFile,
  createDir,
  copyAndReplaceAll,
  copyAndReplaceWithChangedCallback,
} = require('../generator-common');

const macOSDir = 'macos';
const oldProjectName = 'HelloWorld';

/**
 * @param {string} srcRootPath
 * @param {string} destPath
 * @param {string} newProjectName
 * @param {{ overwrite?: boolean }} options
 */
function copyProjectTemplateAndReplace(
  srcRootPath,
  destPath,
  newProjectName,
  options = {}
) {
  if (!srcRootPath) {
    throw new Error('Need a path to copy from');
  }

  if (!destPath) {
    throw new Error('Need a path to copy to');
  }

  if (!newProjectName) {
    throw new Error('Need a project name');
  }

  createDir(path.join(destPath, macOSDir));
  createDir(path.join(destPath, srcDirPath(newProjectName, 'iOS')));
  createDir(path.join(destPath, srcDirPath(newProjectName, 'macOS')));
  createDir(path.join(destPath, xcodeprojPath(newProjectName)));
  createDir(path.join(destPath, schemesPath(newProjectName)));

  const templateVars = {
    [oldProjectName]: newProjectName,
  };

  [
    { from: path.join(srcRootPath, macOSDir, 'Podfile'), to: path.join(macOSDir, 'Podfile') },
    { from: path.join(srcRootPath, srcDirPath(oldProjectName, 'iOS')), to: srcDirPath(newProjectName, 'iOS') },
    { from: path.join(srcRootPath, srcDirPath(oldProjectName, 'macOS')), to: srcDirPath(newProjectName, 'macOS') },
    { from: path.join(srcRootPath, pbxprojPath(oldProjectName)), to: pbxprojPath(newProjectName) },
    { from: path.join(srcRootPath, schemePath(oldProjectName, 'iOS')), to: schemePath(newProjectName, 'iOS') },
    { from: path.join(srcRootPath, schemePath(oldProjectName, 'macOS')), to: schemePath(newProjectName, 'macOS') },
  ].forEach((mapping) => copyAndReplaceAll(mapping.from, destPath, mapping.to, templateVars, options.overwrite));

  [
    { from: path.join(srcRootPath, 'react-native.config.js'), to: 'react-native.config.js' },
  ].forEach((mapping) => appendToExistingFile(mapping.from, mapping.to, templateVars));

  [
    { from: path.join(srcRootPath, 'metro.config.macos.js'), to: 'metro.config.macos.js' },
  ].forEach((mapping) => copyAndReplaceWithChangedCallback(mapping.from, destPath, mapping.to, templateVars, options.overwrite));

  console.log(`
  ${chalk.blue(`Run instructions for ${chalk.bold('macOS')}`)}:
    • cd macos && pod install && cd ..
    • npx react-native run-macos
    ${chalk.dim('- or -')}
    • Open ${xcworkspacePath(newProjectName)} in Xcode or run "xed -b ${macOSDir}"
    • yarn start:macos
    • Hit the Run button
`);
}

/**
 * @param {string} basename
 * @param {"iOS" | "macOS"} platform
 */
function projectName(basename, platform) {
  return basename + '-' + platform;
}

/**
 * @param {string} basename
 * @param {"iOS" | "macOS"} platform
 */
function srcDirPath(basename, platform) {
  return path.join(macOSDir, projectName(basename, platform));
}

/**
 * @param {string} basename
 */
function xcodeprojPath(basename) {
  return path.join(macOSDir, basename + '.xcodeproj');
}

/**
 * @param {string} basename
 */
function xcworkspacePath(basename) {
  return path.join(macOSDir, basename + '.xcworkspace');
}

/**
 * @param {string} basename
 */
function pbxprojPath(basename) {
  return path.join(xcodeprojPath(basename), 'project.pbxproj');
}

/**
 * @param {string} basename
 */
function schemesPath(basename) {
  return path.join(xcodeprojPath(basename), 'xcshareddata', 'xcschemes');
}

/**
 * @param {string} basename
 * @param {"iOS" | "macOS"} platform
 */
function schemePath(basename, platform) {
  return path.join(schemesPath(basename), projectName(basename, platform) + '.xcscheme');
}

/**
 * @param {{ verbose?: boolean }=} options
 */
function installDependencies(options) {
  const cwd = process.cwd();

  // Patch package.json to have start:macos
  const projectPackageJsonPath = path.join(cwd, 'package.json');
  /** @type {{ scripts?: {} }} */
  const projectPackageJson = JSON.parse(fs.readFileSync(projectPackageJsonPath, { encoding: 'UTF8' }));
  const scripts = projectPackageJson.scripts || {};
  scripts['start:macos'] = 'node node_modules/react-native-macos/local-cli/cli.js start --use-react-native-macos';
  projectPackageJson.scripts = scripts;
  fs.writeFileSync(projectPackageJsonPath, JSON.stringify(projectPackageJson, null, 2));

  // Install dependencies using correct package manager
  const isYarn = fs.existsSync(path.join(cwd, 'yarn.lock'));

  /** @type {{ stdio?: 'inherit' }} */
  const execOptions = options && options.verbose ? { stdio: 'inherit' } : {};
  childProcess.execSync(isYarn ? 'yarn' : 'npm i', execOptions);
}

module.exports = {
  copyProjectTemplateAndReplace,
  installDependencies,
};
