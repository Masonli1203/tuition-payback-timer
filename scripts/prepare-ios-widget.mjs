import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareIOSIcons } from './prepare-ios-icons.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const apple = `${root}src-tauri/gen/apple`;
function run(command, args, cwd = apple) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
// Parse Tauri's generated YAML without a new npm dependency. macOS includes Ruby
// and Psych. Preserve native signing/settings rather than replacing the host spec.
const spec = JSON.parse(run('/usr/bin/ruby', ['-rjson', '-ryaml', '-e',
  'puts JSON.generate(YAML.load_file(ARGV[0]))', 'project.yml']));
const mainPath = `${apple}/Sources/tuition-payback/main.mm`;
let main = await readFile(mainPath, 'utf8');
if (!main.includes('tuition_widget_install();')) {
  if (!main.includes('ffi::start_app();')) throw new Error('Unrecognized Tauri iOS entry point.');
  main = 'extern "C" void tuition_widget_install(void);\n' + main.replace('ffi::start_app();', 'tuition_widget_install();\n\tffi::start_app();');
  await writeFile(mainPath, main);
}
const host = spec.targets['tuition-payback_iOS'];
if (!host) throw new Error('Run npm run ios:init first. Expected Tauri iOS target is missing.');
await prepareIOSIcons();
host.settings.base.ASSETCATALOG_COMPILER_APPICON_NAME = 'AppIcon';
const identifier = process.argv.includes('--verification')
  ? 'com.mason.tuition-payback.ios-widget-verification'
  : 'com.mason.tuition-payback.ios-dev';
const group = `group.${identifier}`;
const iosConfig = JSON.parse(await readFile(`${root}src-tauri/tauri.ios.conf.json`, 'utf8'));
const team = process.env.APPLE_DEVELOPMENT_TEAM || iosConfig.bundle?.iOS?.developmentTeam
  || host.settings.base.DEVELOPMENT_TEAM || spec.settingGroups?.app?.base?.DEVELOPMENT_TEAM;
if (team) host.settings.base.DEVELOPMENT_TEAM = team;
host.settings.base.PRODUCT_BUNDLE_IDENTIFIER = identifier;
host.info.properties.WidgetAppGroup = group;
await mkdir(`${apple}/WidgetSources`, { recursive: true });
await cp(`${root}ios/Widget`, `${apple}/WidgetSources`, { recursive: true });
await mkdir(`${apple}/WidgetBridge`, { recursive: true });
await cp(`${root}ios/Bridge`, `${apple}/WidgetBridge`, { recursive: true });
host.sources = host.sources.map(source => source.path === 'Externals'
  ? { ...source, excludes: [...(source.excludes || []), '**/*.a'] } : source);
host.sources.push({ path: 'WidgetBridge' }, { path: 'WidgetSources/WidgetModel.swift' });
host.dependencies.push({ target: 'TuitionPaybackWidget', embed: true });
host.settings.base.SWIFT_VERSION = '5.0';
host.entitlements.properties = {
  ...host.entitlements.properties,
  'com.apple.security.application-groups': [group],
};
spec.targets.TuitionPaybackWidget = {
  type: 'app-extension', platform: 'iOS', deploymentTarget: '16.0',
  sources: [{ path: 'WidgetSources' }],
  settings: { base: {
    PRODUCT_BUNDLE_IDENTIFIER: `${identifier}.widget`,
    PRODUCT_NAME: 'TuitionPaybackWidget', SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '1,2', SKIP_INSTALL: true,
    ...(team ? { DEVELOPMENT_TEAM: team } : {}),
    CODE_SIGN_STYLE: 'Automatic',
  } },
  info: { path: 'WidgetSources/Info.plist', properties: {
    CFBundleDisplayName: 'Tuition Payback', WidgetAppGroup: group,
    CFBundleShortVersionString: host.info.properties.CFBundleShortVersionString,
    CFBundleVersion: host.info.properties.CFBundleVersion,
    NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
  } },
  entitlements: { path: 'WidgetSources/Widget.entitlements', properties: {
    'com.apple.security.application-groups': [group],
  } },
};
await writeFile(`${apple}/project-widget.json`, JSON.stringify(spec, null, 2));
console.log(run('xcodegen', ['generate', '--spec', 'project-widget.json']));
