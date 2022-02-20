import Apify from 'apify';
import { findPairInHistoryPairs, shuffleArrayInPlace } from './utils';

const { utils: { log } } = Apify;

export type Pair = [string, string];
type HistoryState = Record<string, Pair[]>
interface Input {
    names: string[],
    teamName: string,
    slackToken: string | undefined,
    slackChannel: string | undefined,
    slackMessage: string | undefined,
}

const STATE_KV_STORE_NAME = 'PEOPLE-PAIRING-HISTORY';
const DEFAULT_KV_RECORD_KEY = 'My best team';

Apify.main(async () => {
    const {
        names,
        teamName = DEFAULT_KV_RECORD_KEY,
        slackToken,
        slackChannel,
        slackMessage = `Chosen pairs are:`,
    } = await Apify.getInput() as Input;

    if (slackChannel || slackToken) {
        if (!(slackChannel && slackToken)) {
            throw new Error(`Wrong Input: You must provide both slackChannel and slackToken!`);
        }
    }

    const teamNameSanitized = teamName.replace(/[^A-Za-z0-9.-]/g, '-')

    const stateStore = await Apify.openKeyValueStore(STATE_KV_STORE_NAME);
    let historyState = (await stateStore.getValue(teamNameSanitized) || {}) as HistoryState;
    let allHistoryPairs = Object.values(historyState).flat(1);

    const namesAssigned = {} as Record<string, boolean>;
    for (const name of names) {
        namesAssigned[name] = false;
    }
    let succeeded = false;
    const chosenPairs = [];

    shuffleArrayInPlace(names);
    log.info(`Provided names after shuffling:`);
    console.dir(names);

    while (!succeeded) {
        for (const name1 of names) {
            for (const name2 of names) {
                if (name1 === name2) {
                    continue;
                }
                if (namesAssigned[name1] || namesAssigned[name2]) {
                    continue;
                }
                const newPair = [name1, name2] as Pair;
                const pairFound = findPairInHistoryPairs(allHistoryPairs, newPair);
                if (!pairFound) {
                    chosenPairs.push(newPair);
                    // We update the history so we check with the new pair in next loop
                    allHistoryPairs.push(newPair);
                    namesAssigned[newPair[0]] = true;
                    namesAssigned[newPair[1]] = true;
                }
            }
        }
        // Now we can be in 3 states
        // 1. All names are assigned, great, we are done
        // 2. One person is left out as odd, well good luck to him/her next time
        // 3. Two or more people are not assigned, we need to restart history and loop again

        const nonAssignedCount = Object.values(namesAssigned)
            .filter((isAssigned) => !isAssigned)
            .length;

        if (nonAssignedCount <= 1) {
            succeeded = true;
        } else {
            log.warning(`We cannot create new pairs anymore, restarting history`);
            historyState = {};
            allHistoryPairs = [];
        }
    }

    log.info(`Chosen pairs are:`);
    console.dir(chosenPairs);

    const oddLeftOutName = Object.entries(namesAssigned)
        .find(([, assigned]) => !assigned)?.[0] || 'none';
    log.info(`Left out because odd: ${oddLeftOutName}`);

    const date = new Date().toISOString();
    historyState[date] = chosenPairs;
    await stateStore.setValue(teamNameSanitized, historyState);

    if (slackToken) {
        const fullMessage = `*${slackMessage}*\n`
            + `${chosenPairs.map(([name1, name2]) => `${name1} + ${name2}`).join('\n')}\n`
            + `Left out as odd (Good luck next time): ${oddLeftOutName}`;

        const slackInput = {
            text: fullMessage,
            channel: slackChannel,
            token: slackToken,
        };

        log.info(`Calling katerinahronik/slack-message actor to post Slack message`);
        await Apify.newClient().actor('katerinahronik/slack-message')
            .call(slackInput);
        log.info(`Slack message delivered, ending this run`);
    }
});
