import fs from 'fs';
import fetchStreams from './fetchData.js'; // Assuming fetchStreams is exported from alfaFrens2.js

const ALFA_DECIMALS = 1e12;


let PRIVATE = false;
let RELOAD = false; // 30 min default

process.argv.forEach(arg => {
    if (arg.toUpperCase() === "PUBLIC") {
        PRIVATE = false;
    }
    if (arg.toUpperCase() === "PRIVATE") {
        PRIVATE = true;
    }
    if (arg.toUpperCase() === "RELOAD") {
        RELOAD = true;
    }
});
// Load allStreams data from JSON file
let oldData, lastUpdated;
if (fs.existsSync('./results/allStreams.json')) {
    oldData = JSON.parse(fs.readFileSync('./results/allStreams.json', 'utf-8'));
    lastUpdated = oldData.lastUpdatedTimestamp;
} else {
    oldData = {}; // Initialize as an empty object if file does not exist
    lastUpdated = 0;
}
// Check if data is outdated

const currentTime = Date.now();

const fetchData = async () => {
    await fetchStreams();
    console.log("after fetch stream");
    return JSON.parse(fs.readFileSync('./results/allStreams.json', 'utf-8'));
}

const summarize = (data) => {
    const subscribers = {};
    const channels = {};
    const stakers = {};
    const cashbackPools = {};
    let badUsers = 0;
    const streamsData = data.streams;
    const poolData = data.poolMembers;
    streamsData.forEach(stream => {
        const senderId = stream.sender.id;
        const receiverId = stream.receiver.id;

        if (subscribers[senderId]) {
            subscribers[senderId].count += 1;
        } else {
            subscribers[senderId] = { id: senderId, count: 1 };
        }

        if (channels[receiverId]) {
            channels[receiverId].count += 1;
        } else {
            channels[receiverId] = { id: receiverId, count: 1 };
        }
    });

    poolData.forEach(pool => {
        const channel = pool.pool.admin.id;
        const stakerId = pool.account.id;
        if(pool.channelOwner) {
            cashbackPools[channel] = {
                id: channel, 
                owner: stakerId,
                totalStake: Number(pool.pool.totalUnits),
                totalCashBack: Number(pool.pool.flowRate),
                totalMembers: Number(pool.pool.totalMembers),
            };
        }
    });
    poolData.forEach(pool => {
        const cashback = Number(pool.pool.flowRate)/Number(pool.pool.totalUnits)*Number(pool.units);
        if(pool.units > 0) {
                    if (stakers[pool.account.id]) {
                        stakers[pool.account.id].alfa += (Number(pool.units));
                        stakers[pool.account.id].cashback += cashback;
                        stakers[pool.account.id].stakes += 1;
                    } else {
                        stakers[pool.account.id] = {
                            id: pool.account.id,
                            alfa: Number(pool.units),
                            stakes: 1,
                            cashback: cashback
                        };
                    }
        } else {
            // this is a bad user, add them to a counter
            badUsers += 1;
        }
    });
    //console.log("your stake: ", Math.round(stakers[("0x59D7EB03449949eDf55133b477599207F54Cc1ce").toLowerCase()].alfa / ALFA_DECIMALS));

    const {totalStake, totalCashBack, totalMembers} = Object.values(cashbackPools).reduce((acc, pool) => {
        acc.totalStake += pool.totalStake;
        acc.totalCashBack += pool.totalCashBack*0.75;
        acc.totalMembers += pool.totalMembers;
        return acc;
    }, { totalStake: 0, totalCashBack: 0, totalMembers: 0 });

    const sortedSubscribers = Object.values(subscribers).sort((a, b) => b.count - a.count);
    const sortedChannels = Object.values(channels).sort((a, b) => b.count - a.count);
    const sortedStakersCashback = Object.values(stakers).sort((a, b) => b.cashback - a.cashback);
    const sortedStakersAlfa = Object.values(stakers).sort((a, b) => b.alfa - a.alfa);
    const sortedStakersStakes = Object.values(stakers).sort((a, b) => b.stakes - a.stakes);

    console.log("\nTop subscribers by number of streams:");
    sortedSubscribers.slice(0, 10).forEach(subscriber => {
    console.log(`ID: ${subscriber.id}, Streams Sent: ${subscriber.count}`);
    });

    console.log("\nTop channels by number of streams received:");
    sortedChannels.slice(0, 10).forEach(channel => {
    console.log(`ID: ${channel.id}, Streams Received: ${channel.count}`);
    });

    console.log("\nTop Stakers by cashback received:");
    sortedStakersCashback.slice(0, 10).forEach(staker => {
    console.log(`ID: ${staker.id}, Cashback Received: ${Math.round(staker.cashback*60*60*24/1e18)} $DEGEN/day`);
    });

    console.log("\nTop Staskers of ALFA:");
    sortedStakersAlfa.slice(0, 10).forEach(staker => {
    console.log(`ID: ${staker.id}, Staked: ${Math.round(staker.alfa/ALFA_DECIMALS)} $ALFA`);
    });
    console.log("\nTop Staskers by number of stakes:");
    sortedStakersStakes.slice(0, 10).forEach(staker => {
    console.log(`ID: ${staker.id}, Stake #: ${staker.stakes}`);
    });

    const uniqueUsers = new Set();
    streamsData.forEach(stream => {
        uniqueUsers.add(stream.sender.id);
    });

    const totalFlowRate = streamsData.reduce((total, stream) => (total + Number(stream.currentFlowRate)), 0);

    console.log("Total Flow Rate: \t", Math.floor(totalFlowRate*60*60*24/1e18), "$DEGEN/day");
    console.log("Total Cash Back:\t", Math.floor(totalCashBack*60*60*24/1e18), "$DEGEN/day");
    console.log("Creator Fees:\t\t", Math.floor(totalFlowRate*0.25*60*60*24/1e18), "$DEGEN/day");
    console.log("Platform fees:\t\t", Math.floor(totalFlowRate*0.05*60*60*24/1e18), "\t$DEGEN/day");
    console.log("Total $ALFA Staked: \t", Math.round(totalStake/ALFA_DECIMALS), "$ALFA");
    console.log("Total # of users: \t", uniqueUsers.size);
    console.log("Total # of streams: \t", streamsData.length);
    console.log("Total # unique stakes:\t", totalMembers);
    PRIVATE && console.log("stakes with no alfa:\t", badUsers);
    console.log("Total # of channels: ");
    console.log("   with subscribers:\t", Object.keys(channels).length);
    console.log("   with stakers:\t", Object.keys(cashbackPools).length);

    const averageStreamsPerUser = streamsData.length / uniqueUsers.size;
    const averageStreamsPerChannel = streamsData.length / Object.keys(channels).length;
    const averageStakersPerChannel = totalMembers / Object.keys(channels).length;
    console.log("AVERAGES:")
    console.log("reward per $ALFA staked:", Number(((totalCashBack*60*60*24/1e18)/(totalStake/ALFA_DECIMALS)).toFixed(2)), "\t$DEGEN/day");
    console.log("streams per user: \t", Math.round(averageStreamsPerUser.toFixed(2)));
    console.log("streams per channel:\t", Math.round(averageStreamsPerChannel.toFixed(2)));
    console.log("stakers per channel:\t", Math.round(averageStakersPerChannel.toFixed(2)));

    const summary = {
    totalChannels: Object.keys(channels).length,
    totalStreams: streamsData.length,
    totalUsers: uniqueUsers.size,
    averageStreamsPerUser: averageStreamsPerUser.toFixed(2),
    averageStreamsPerChannel: averageStreamsPerChannel.toFixed(2),
    totalFlowRate,
    topSubscribers: sortedSubscribers.map(subscriber => ({
        id: subscriber.id,
        streamsSent: subscriber.count
    })),
    topChannels: sortedChannels.map(channel => ({
        id: channel.id,
        streamsReceived: channel.count
    })),

    // topStakers, //todo
    // topStakes, //todo
    };
    fs.writeFileSync('./results/allChannels.json', JSON.stringify(poolData, null, 2));

    fs.writeFileSync('./results/streamSummary.json', JSON.stringify(summary, null, 2));
}

if (RELOAD) {
    const data = await fetchData();
    console.log('Data is outdated, fetching new streams...');
    summarize(data);
} else {
    console.log('Data is up-to-date. Summarizing...');
    summarize(oldData);
}