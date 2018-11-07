import * as path from 'path'
import * as fs from 'fs'
import * as semver from 'semver'
import { License } from './section';

export interface Author {
  name?: string;
  email?: string;
  url?: string;
}

interface DeprecatedLicense {
  type?: string;
  url?: string;
}

interface DeprecatedContent {
  licenses?: DeprecatedLicense[];
  license?: DeprecatedLicense;
}

export interface Repository {
  type: string;
  url: string;
}

export interface PackageContent {
  name: string;
  version: string;
  packageJson: string[];
  contributors?: (string | Author)[];
  author?: string | Author;
  description?: string;
  repository?: string | Repository;
  homepage?: string;
  license?: string;
}

interface Dependency {
  [index: string]: string;
}

interface RawPackageDependencies {
  dependencies: Dependency;
  devDependencies: Dependency;
  optionalDependencies: Dependency;
}

export interface PackageDependencies {
  packageDependencies: PackageContent[];
  packageDevDependencies: PackageContent[];
  packageOptionalDependencies: PackageContent[];
}

export interface InvalidPackageContent {
  copyright: PackageContent[];
  license: PackageContent[];
}

function isSamePackageContent(left: PackageContent, right: PackageContent) {
  return left.name === right.name && left.version === right.version;
}

function groupSameContents<T extends (PackageContent)>(contents: T[]): T[] {
  let uniques: T[] = [];
  contents.forEach((content) => {
    let foundUniqueItem = uniques.find((uniqueItem) => {
      return content !== uniqueItem && isSamePackageContent(content, uniqueItem);
    });
    if(foundUniqueItem === undefined) {
      uniques.push(content);
      return;
    }
    foundUniqueItem.packageJson = foundUniqueItem.packageJson.concat(content.packageJson);
  });

  return uniques;
}

function getPackageFileFromDirectory (dir: string) {
  let files: string[] = [];
  const directoryItems = fs.readdirSync(dir);
  for (let directoryItem of directoryItems) {
    const absItem = path.join(dir, directoryItem);
    if (fs.statSync(absItem).isDirectory()) {
      files = files.concat(getPackageFileFromDirectory(absItem));
    } else {
      if (directoryItem !== "package.json") {
        continue;
      }
      files.push(absItem);
    }
  }

  return files;
}

function getPackageFiles (nodeModulePaths: string[]) {
  const paths: string[] = [];
  for(const nodeModulesPath of nodeModulePaths) {
    paths.push(...getPackageFileFromDirectory(nodeModulesPath));
  }
  return paths;
}

function resolveRawDependencies(contents: (PackageContent & RawPackageDependencies)[]): (PackageContent & RawPackageDependencies & PackageDependencies)[] {

  const resolve = (dependencies: Dependency) => {
    let result : (PackageContent & RawPackageDependencies)[] = [];
    for(let packageName in dependencies) {
      const versionSemanticString = dependencies[packageName];
      const referencedLib = contents.find((pack) => {
        return pack.name === packageName && semver.satisfies(pack.version, versionSemanticString);
      });
      if(referencedLib !== undefined)
        result.push(referencedLib);
    }
    return result;
  };

  return contents.map((content) => {

    const resolvedDependencies: PackageDependencies = {
      packageDependencies: resolve(content.dependencies),
      packageDevDependencies: resolve(content.devDependencies),
      packageOptionalDependencies: resolve(content.optionalDependencies)
    };

    return Object.assign(content, resolvedDependencies);
  });
}

function removeUnreferencedContents(contents: (PackageContent & PackageDependencies)[], targetPackage: (PackageContent & PackageDependencies)) {
  return contents.filter((content) => {
    if(content === targetPackage) {
      return true;
    }
    for(let c of contents) {
      if(c === content)
        continue;

      if(c.packageDependencies.includes(content) || c.packageDevDependencies.includes(content) || c.packageOptionalDependencies.includes(content))
        return true;
    }
    return false;
  });
}

export function collectPackageInfos(packageJson: string, nodeModulePaths: string[]) {

  const transformDeprecatedContent = (content: PackageContent, deprecatedContent: DeprecatedContent) => {
    if(content.license && typeof content.license === "string") {
      return;
    }

    if(deprecatedContent.license !== undefined && deprecatedContent.license.type !== undefined) {
      if(!deprecatedContent.licenses)
        deprecatedContent.licenses = []
      deprecatedContent.licenses.push(deprecatedContent.license);
    }

    if(!deprecatedContent.licenses) {
      return;
    }

    const types:string[] = [];
    for(let license of deprecatedContent.licenses) {
      if(!license.type)
        continue;

      types.push(license.type);
    }

    if(types.length > 1) {
      content.license = "(" + types.join(" OR ") + ")";
      return;
    }

    if(types.length === 1) {
      content.license = types[0];
    }
  };

  let contents: (PackageContent & RawPackageDependencies)[] = getPackageFiles(nodeModulePaths).map((file) => {
    const fileContents = fs.readFileSync(file).toString();
    const contents = JSON.parse(fileContents);

    const packageContent: PackageContent & RawPackageDependencies = contents;
    packageContent.packageJson = [file];
    transformDeprecatedContent(packageContent, contents);

    return packageContent;
  });

  // removeDuplicates(contents);
  contents = groupSameContents(contents);
  contents.push(JSON.parse(fs.readFileSync(packageJson).toString()));
  const resolvedContents = resolveRawDependencies(contents);
  const referencedContents = removeUnreferencedContents(resolvedContents, resolvedContents[resolvedContents.length - 1]);
  referencedContents.pop();
  return referencedContents;
}

export function findInvalidPackageContent(
  packageContents: (PackageContent & PackageDependencies)[],
  allowedLicenses: License[],
  evaluateCopyrightInfo: (content: PackageContent) => boolean
) {

const invalid: InvalidPackageContent = {
  copyright: [],
  license: []
}
for(let content of packageContents) {
  if(!allowedLicenses.find( (l: License) => { return l.name === content.license; } )) {
    invalid.license.push(content);
  }

  if(evaluateCopyrightInfo(content) === false) {
    invalid.copyright.push(content);
  }
}
return invalid;
}
