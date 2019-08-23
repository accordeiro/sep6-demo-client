import "./style.scss";
import * as uiActions from "./ui/ui-actions";

// require("./ui/show-all-types")(uiActions);

const Config = require("./config");
const StellarSdk = require("stellar-sdk");

Config.listen(() => {
  const disclaimer = document.getElementById("pubnet-disclaimer");
  if (Config.get("PUBNET")) {
    disclaimer.classList.add("visible");
    StellarSdk.Network.usePublicNetwork();
  } else {
    disclaimer.classList.remove("visible");
    StellarSdk.Network.useTestNetwork();
  }
});

Config.installUI(document.querySelector("#config-panel"));
if (!Config.isValid()) {
  uiActions.showConfig();
}

/**
 * State maintained between steps
 * @typedef {Object} State
 * @property {string} auth_server - URL hosting the SEP10 auth server
 * @property {string} transfer_server - URL hosting the SEP6 transfer server
 * @property {string} interactive_url - URL hosting the interactive webapp step
 * @property {string} challenge_transaction - XDR Representation of Stellar challenge transaction signed by server only
 * @property {Object} signed_challenge_tx - Stellar transaction challenge signed by both server and client
 * @property {string} token - JWT token representing authentication with stellar address from SEP10
 * @property {string} anchors_stellar_address - Address that the anchor will be expecting payment on for the in-flight transaction
 * @property {string} stellar_memo_type - Memo type for the stellar transaction to specify the anchor's transaction
 * @property {string} stellar_memo - Memo required for the specified stellar transaction
 * @property {string} external_transaction_id - The reference identifier needed to retrieve or confirm the withdrawal
 *
 * Deposit
 * @property {string} deposit_memo - The memo we asked the anchor to send our funds with
 * @property {string} deposit_type - The memo type we asked the anchor to send our funds with
 * @property {string} deposit_url - The more_info_url used to bring up info on the deposit
 */

/**
 * @type State
 */
const state = {};

const withdrawSteps = [
  require("./steps/initial"),
  require("./steps/check_toml"),
  require("./steps/check_info"),
  require("./steps/SEP10/start"),
  require("./steps/SEP10/sign"),
  require("./steps/SEP10/send"),
  require("./steps/withdraw/get_withdraw"),
  require("./steps/withdraw/show_interactive_webapp"),
  require("./steps/withdraw/confirm_payment"),
  require("./steps/withdraw/send_stellar_transaction"),
  require("./steps/withdraw/poll_for_success"),
];

const depositSteps = [
  require("./steps/initial"),
  // require("./steps/check_toml"),
  require("./steps/deposit/check_info"),
  // require("./steps/SEP10/start"),
  // require("./steps/SEP10/sign"),
  // require("./steps/SEP10/send"),
  require("./steps/deposit/get_deposit"),
  require("./steps/deposit/show_interactive_webapp"),
  require("./steps/deposit/poll_transaction_status"),
];

let steps = null;

uiActions.instruction(
  "Withdraw and deposit are available for trusted assets in the wallet",
);
uiActions.setLoading(true, "Waiting for user...");
uiActions.waitForPageMessage("pages/wallet.html").then((message) => {
  uiActions.setLoading(false);
  if (message === "start-withdraw") {
    steps = withdrawSteps;
    next();
  } else if (message === "start-deposit") {
    steps = depositSteps;
    next();
  }
});

let currentStep = null;
const runStep = (step) => {
  if (!step) {
    uiActions.setLoading(true, "Finished");
    return;
  }
  uiActions.setDevicePage(step.devicePage || "pages/loader.html");
  uiActions.instruction(step.instruction);
  currentStep = step;
  if (Config.get("AUTO_ADVANCE") || step.autoStart) next();
};

const next = async () => {
  if (currentStep && currentStep.execute) {
    uiActions.setLoading(true);
    try {
      await Promise.all([
        currentStep.execute(state, uiActions),
        // Take at least a second for each step otherwise its overwhelming
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      steps.splice(0, 1);
    } catch (e) {
      uiActions.error(e);
      uiActions.setLoading(false);
      throw e;
    }

    uiActions.setLoading(false, steps[0].action);
  }
  runStep(steps[0]);
};

uiActions.onNext(next);
