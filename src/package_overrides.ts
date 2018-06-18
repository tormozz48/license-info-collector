import { PackageContent, PackageDependencies } from './package_infos'

enum OverrideSection  {
  Homepage,
  License
}

export interface Override {
  name: string;
  version: string;
  new: string;
  comment: string;
}

export interface Overrides {
  homepage: Override[];
  license: Override[];
}

function findOverrides (
    packages: PackageContent[], 
    overrides: Overrides, 
    overrideMatch: (pack: undefined | PackageContent, override: Override, overrideSection: OverrideSection) => void
  ) {

  const getPackageFn = (o: Override) => (pack:PackageContent) => {
    return o.name === pack.name && o.version == pack.version;
  };

  for(let override of overrides.homepage) {
    overrideMatch(packages.find(getPackageFn(override)), override, OverrideSection.Homepage);
  }

  for(let override of overrides.license) {
    overrideMatch(packages.find(getPackageFn(override)), override, OverrideSection.License);
  }
}

export function applyOverrides (packages: PackageContent[], overrides: Overrides) {
  findOverrides(packages, overrides, (pack, override, overrideSection) => {
    if(!pack)
      return;

    switch(overrideSection) {
      case OverrideSection.Homepage: {
        pack.homepage = override.new;
        return;
      }
      case OverrideSection.License: {
        pack.license = override.new;
        return;
      }
    }
  });
}

export function findUnusedOverrides (packages: PackageContent[], overrides: Overrides) {
  const unusedOverrides: Overrides = {
    license: [],
    homepage: []
  };
  findOverrides(packages, overrides, (pack, override, overrideSection) => {
    if(pack)
      return;
    
      switch(overrideSection) {
        case OverrideSection.Homepage: {
          unusedOverrides.homepage.push(override);
          return;
        }
        case OverrideSection.License: {
          unusedOverrides.license.push(override);
          return;
        }
      }
  });
  return unusedOverrides;
}