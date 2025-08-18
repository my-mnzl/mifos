const { gitDescribeSync } = require('git-describe');
const { resolve, relative } = require('path');
const { writeFileSync } = require('fs-extra');

const gitInfo = gitDescribeSync({
  dirtyMark: false,
  dirtySemver: false
});

gitInfo.version = '1.12.1';

const file = resolve(__dirname, '.', 'src', 'environments', '.env.ts');
writeFileSync(
  file,
  `// IMPORTANT: THIS FILE IS AUTO GENERATED! DO NOT MANUALLY EDIT OR CHECKIN!
/* tslint:disable */
export default {
  'mifos_x': {
    'version': '${gitInfo.version}',
    'hash': '${gitInfo.hash}'
  },
  'allow_switching_backend_instance': false
};
/* tslint:enable */
`,
  { encoding: 'utf-8' }
);

console.log(`Wrote version info ${gitInfo.raw} to ${relative(resolve(__dirname, '..'), file)}`);
