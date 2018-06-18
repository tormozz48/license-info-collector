import { PackageContent } from './package_infos'
import * as fs from 'fs'
import * as path from 'path'

export interface License {
  file?: string;
  name: string;
}

export interface LicenseSection {
  license: string;
  licenseText?: string;
  libraries: PackageContent[];
}

function orderByLicense(packageInfos: PackageContent[]) {
  const getLicenseStr = (a: string) => {
    return a === undefined ? "" : a;
  }

  packageInfos.sort((a: PackageContent, b: PackageContent) => {
    return getLicenseStr(a.license).localeCompare(getLicenseStr(b.license));
  });
}

function readLicenseText(licenseName: string, licensefiles: License[], licensesDirectory: string) {
  const license = licensefiles.find((l : License) => {return l.name === licenseName;});
  if(!license || !license.file) {
    return undefined;
  }

  const licenseText = fs.readFileSync(path.join(licensesDirectory, license.file)).toString();
  return licenseText;
}

export function gatherLicenseSections(packageInfos: PackageContent [], licenses: License[], licensesDirectory: string = "") {
  orderByLicense(packageInfos);

  const licenseSections: LicenseSection[] = [];
  for(let info of packageInfos) {
    if(licenseSections.length === 0 || licenseSections[licenseSections.length - 1].license !== info.license) {
      licenseSections.push({
        license: info.license,
        licenseText: readLicenseText(info.license, licenses, licensesDirectory),
        libraries: []
      });
    }
    licenseSections[licenseSections.length - 1].libraries.push(info);
  }

  for(let license of licenseSections) {
    license.libraries.sort((a: PackageContent, b: PackageContent) => {
      return a.name.localeCompare(b.name);
    });
  }

  return licenseSections;
}