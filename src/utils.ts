import { Pair } from './main';

const containsAll = (arr1: string[], arr2: string[]) => {
    return arr2.every((arr2Item) => arr1.includes(arr2Item));
};

export const findPairInHistoryPairs = (history: Pair[], pair: Pair): boolean => {
    return !!history.find((pairHistorical) => {
        return containsAll(pairHistorical, pair);
    });
};

export const shuffleArrayInPlace = (array: any[]) => {
    let currentIndex = array.length;
    let randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
};
