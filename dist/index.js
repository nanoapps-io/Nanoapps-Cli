#!/usr/bin/env node
"use strict";

var _prompt = require("prompt");

var _prompt2 = _interopRequireDefault(_prompt);

var _homedir = require("homedir");

var _homedir2 = _interopRequireDefault(_homedir);

var _config = require("./config");

var configs = _interopRequireWildcard(_config);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _jsonfile = require("jsonfile");

var _jsonfile2 = _interopRequireDefault(_jsonfile);

var _axios = require("axios");

var _axios2 = _interopRequireDefault(_axios);

var _commander = require("commander");

var _commander2 = _interopRequireDefault(_commander);

var _shelljs = require("shelljs");

var _shelljs2 = _interopRequireDefault(_shelljs);

var _formData = require("form-data");

var _formData2 = _interopRequireDefault(_formData);

var _child_process = require("child_process");

var _child_process2 = _interopRequireDefault(_child_process);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_commander2.default.command('login').description('Login to nanoapps console').action(function () {
    console.log("Enter your email and password");
    Login();
});

_commander2.default.command('create').description('Create nanoapps').action(function () {
    CompilandUploadBundleFile();
});

_commander2.default.parse(process.argv);

function Login() {
    _prompt2.default.start();
    var properties = [{
        name: 'Email'
    }, {
        name: 'Password',
        hidden: true
    }];
    _prompt2.default.get(properties, function (err, result) {
        if (err) {
            return onErr(err);
        }
        var data = {
            email: result.Email,
            password: result.Password
        };
        _axios2.default.post(configs.API_URL + "/developer/login", data).then(function (response) {
            if (response['data'].status == "success") {
                console.log("Login successfull");
                persistToken(response['data']);
            } else {
                console.log("Login failed");
                console.log(response['data'].message);
            }
        }).catch(function (error) {
            console.log(error);
        });
    });
}

function onErr(err) {
    console.log(err);
    return 1;
}

function checkAvailableFiles() {}

function persistToken(response) {
    var dir = (0, _homedir2.default)() + configs.NANOAPPS_FOLDER;
    if (!_fs2.default.existsSync(dir)) {
        _fs2.default.mkdirSync(dir);
    }
    _jsonfile2.default.writeFileSync(dir + configs.CREDS_FILE, response);
}

function getProjectToken() {
    // let file = homedir() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE
    var file = (0, _homedir2.default)() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE;
    var credsFile = _jsonfile2.default.readFileSync(file);
    var authToken = credsFile["token"];
    var packageJsonFile = _jsonfile2.default.readFileSync("package.json");
    var nanoappSettings = packageJsonFile["nanoapp"];
    var data = {
        "project_token": nanoappSettings["project_token"]
    };
    var headers = {
        'Content-Type': 'application/json',
        'X-Nanoapp-Token': 'Bearer ' + authToken
    };
    try {
        _axios2.default.post(configs.API_URL + "/project/verify_token", data, { 'headers': headers }).then(function (response) {
            if (response['data'].status == "success") {
                //uploadBundleFile(response['data']['project'])
            }
        }).catch(function (error) {
            console.log(error);
        });
    } catch (err) {
        console.log(err);
    }
}

function getIndexComponent(indexFileContent) {
    var regex = /AppRegistry\.registerComponent\([\'\"](\w+)[\'\"]/g;
    var group = regex.exec(indexFileContent);
    return group[1];
}

function CompilandUploadBundleFile() {
    var indexFile = "";
    if (_fs2.default.existsSync("index.js")) {
        indexFile = "index.js";
    } else if (_fs2.default.existsSync("index.android.js")) {
        indexFile = "index.android.js";
    }
    if (!indexFile) {
        console.log("index.js or index.android.js does not exist");
        return;
    }

    var file = (0, _homedir2.default)() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE;
    var credsFile = _jsonfile2.default.readFileSync(file);
    var authToken = credsFile["token"];
    var formData = new _formData2.default();
    var nanoappsJson = _jsonfile2.default.readFileSync("./nanoapp.json");

    if (!_fs2.default.existsSync("./nanoapp.json")) {
        console.log("nanoapp.json does not exist");
        return;
    }

    var bundleFile = _fs2.default.readFileSync(indexFile, 'utf8');
    var bundle_gen_cmd = 'node node_modules/react-native/local-cli/cli.js bundle --entry-file="' + indexFile + '" --bundle-output="./main.jsbundle" --dev=false --platform="android"';
    var code = _child_process2.default.execSync(bundle_gen_cmd, { stdio: [0, 1, 2] });
    var indexComponent = getIndexComponent(bundleFile);
    if (code != null) {
        console.log('Error: bundle file generation failed');
        return;
    }

    var data = new _formData2.default();
    data.append('project_token', nanoappsJson['project_token']);
    data.append('name', nanoappsJson['name']);
    data.append('package_name', nanoappsJson['package_name']);
    data.append('version_code', nanoappsJson['version_code']);
    data.append('version_name', nanoappsJson['version_name']);
    data.append('description', nanoappsJson['description']);
    data.append('main_component_name', indexComponent);
    data.append('bundle_file', _fs2.default.createReadStream('./main.jsbundle'), 'main.js');
    if (nanoappsJson['app_icon'] == null) {
        console.log("Please provide an icon for the app");
    }
    data.append('app_icon', _fs2.default.createReadStream(nanoappsJson['app_icon']), nanoappsJson['app_icon']);
    var options = {
        method: 'POST',
        url: configs.API_URL + '/nanoapp/upload',
        headers: {
            'Content-Type': "multipart/form-data; boundary=" + data._boundary,
            'X-Nanoapp-Token': 'Bearer ' + authToken
        },
        data: data
    };
    return (0, _axios2.default)(options).then(function (response) {
        if (response.data['status'] == 'success') {
            console.log("nanoapp successfully created");
        } else if (response.data['status'] == 'success') {
            console.log("Creating nanoapp failed. Please try again later");
        }
    }).catch(function (error) {
        console.log("Error Occurred. Please try again later");
    });
}