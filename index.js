const _ = require('lodash');
const xlsx = require('tfk-json-to-xlsx');
const collector = require('./lib/package_infos');

function isPrimaryPackage(package) {
    return package._requiredBy.some((r) => r === '#DEV:/' || r === '/')
}

function collectPackageInfo(package) {
    const source = package.homepage || _.get(package, 'repository.url', '');

    const getAuthor = (package) => {
        if (_.has(package, 'author.email')) {
            return _.get(package, 'author.email')
        } else if (_.isString(package.author)) {
            return package.author;
        } else {
            return _.stubString();
        }
    }

    return {
        name: package.name,
        version: package.version,
        description: package.description,
        type: 'source',
        author: getAuthor(package),
        source,
        license: package.license,
    }
}

const data = collector
    .collectPackageInfos('package.json', ['./node_modules'])
    .filter(isPrimaryPackage)
    .map(collectPackageInfo);

xlsx.write('dependencies.xlsx', data, function (error) {
    error
        ? console.error(error)
        : console.info('success');
});

