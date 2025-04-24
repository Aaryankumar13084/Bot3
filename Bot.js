require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const { Markup } = require("telegraf");

// Load environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define User Schema
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  mobileNumber: String, // Added mobile number field
  joinedAt: { type: Date, default: Date.now },
  level: { type: Number, default: 1 },
  currentPollIndex: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
});

const User = mongoose.model("User", UserSchema);

//statics command

bot.command("statistics", async (ctx) => {
  const adminId = process.env.ADMIN_ID;  // Admin's Telegram ID

  console.log("Statistics command triggered by:", ctx.from.id); // Debugging log

  if (ctx.from.id.toString() !== adminId) {
    console.log("Unauthorized access attempt to statistics command."); // Debugging log
    return ctx.reply("❌ You are not authorized to view the statistics.");
  }

  try {
    // Get all registered users from the database
    const users = await User.find();

    // Check if there are no users in the database
    if (users.length === 0) {
      console.log("No users in the database."); // Debugging log
      return ctx.reply("No users are registered yet.");
    }

    // Calculate the total number of users and number of levels completed
    const totalUsers = users.length;
    const levelsCompleted = users.filter(user => user.completed).length;

    // Prepare the initial part of the statistics message
    let statistics = `
      Total Users: ${totalUsers}
      Total Levels Completed: ${levelsCompleted}
      
      User Details:
    `;

    // Loop through the users and append their details
    users.forEach(user => {
      statistics += `
        Name: ${user.firstName} ${user.lastName || ''}
        Username: ${user.username || 'N/A'}
        Telegram ID: ${user.telegramId}
        Mobile Number: ${user.mobileNumber || 'Not provided'}
        Levels Completed: ${user.level-1 || 0}
        -------------------------
      `;
    });

    // Split the message into smaller chunks if it's too long
    const MAX_MESSAGE_LENGTH = 4096; // Telegram's maximum message length
    while (statistics.length > MAX_MESSAGE_LENGTH) {
      const part = statistics.slice(0, MAX_MESSAGE_LENGTH); // Take the first chunk
      await ctx.reply(part); // Send the chunk to the admin
      statistics = statistics.slice(MAX_MESSAGE_LENGTH); // Remove the sent chunk from the original string
    }

    // Send any remaining part of the message
    if (statistics.length > 0) {
      await ctx.reply(statistics);
    }

  } catch (err) {
    console.error("Error fetching statistics:", err);
    // Return a detailed error message
    ctx.reply(`An error occurred while fetching the statistics: ${err.message}`);
  }
});


// Delete User Command
bot.command("deleteuser", async (ctx) => {
  const adminId = process.env.ADMIN_ID; // only admin

  if (ctx.from.id.toString() !== adminId) {
    return ctx.reply("❌ You are not authorized to view the statistics.");
  }

  // user id
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return ctx.reply("⚠ mujhe Telegram ID de Ex - `/deleteuser 123456789`");
  }

  const userId = args[1]; // user id

  try {
    const deletedUser = await User.findOneAndDelete({ telegramId: userId });

    if (deletedUser) {
      ctx.reply(`✅ User ${userId} safalta purwak delete Kiya gya.`);
    } else {
      ctx.reply(`⚠ User ${userId} nahi mila`);
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    ctx.reply("❌ user ko delete karne me err.");
  }
});

// 📌 Command to send a message to all registered users  
bot.command("broadcast", async (ctx) => {
  const adminId = process.env.ADMIN_ID;  

  if (ctx.from.id.toString() !== adminId) {
    return ctx.reply("❌ You are not authorized to use this command.");
  }

  const messageText = ctx.message.text.split(" ").slice(1).join(" ");
  if (!messageText) {
    return ctx.reply("⚠ Please provide a message. Example: `/broadcast This is a test message`");
  }

  try {
    const users = await User.find();
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegramId, `📢 *Announcement:*\n\n${messageText}`, { parse_mode: "Markdown" });
      } catch (error) {
        console.error(`Error sending message to ${user.telegramId}:`, error);
      }
    }
    ctx.reply("✅ Message sent to all registered users.");
  } catch (err) {
    console.error("Broadcast Error:", err);
    ctx.reply("❌ Failed to send the message.");
  }
});

// 📌 Command to send a message to a specific user  
bot.command("senduser", async (ctx) => {
  const adminId = process.env.ADMIN_ID;  

  if (ctx.from.id.toString() !== adminId) {
    return ctx.reply("❌ You are not authorized to use this command.");
  }

  const args = ctx.message.text.split(" ");
  if (args.length < 3) {
    return ctx.reply("⚠ Please provide a user ID and message. Example: `/senduser 123456789 Hello, how are you?`");
  }

  const userId = args[1];
  const messageText = args.slice(2).join(" ");

  try {
    await bot.telegram.sendMessage(userId, `📩 *Message:*\n\n${messageText}`, { parse_mode: "Markdown" });
    ctx.reply(`✅ Message sent to user: ${userId}`);
  } catch (err) {
    console.error(`Error sending message to ${userId}:`, err);
    ctx.reply("❌ Failed to send the message.");
  }
});


// Define Poll Questions
const levelPolls = {
  1: [
    { question: "Q1: Green Revolution ka sambandh kis se hai?", options: ["Dugd utpadan se", "Krishi utpadan se", "Jal sanrakshan se", "Pashupalan se"], correctOptionId: 1 },
    { question: "Q2: Audyogik Kranti ka samaj par kaun sa prabhav pada?", options: ["Navik urja ka upyog badhna", "Shahron ki aur mass migration", "Factory system ka ant hona", "Vishv vyapar ka girna"], correctOptionId: 1 },
    { question: "Q3: Internet Revolution ka prabhav kis shetra par sabse zyada pada?", options: ["Krishi", "Shiksha", "Healthcare", "Vyapar aur samajik jeevan"], correctOptionId: 3 },
    { question: "Q4: Social media ka prarambh kis platform se hua tha?", options: ["Facebook", "Twitter", "Instagram", "MySpace"], correctOptionId: 3 },
    { question: "Q5: AI Revolution ka prarambh kis cheez se hua?", options: ["Machine Learning", "Neural Networks", "Supercomputers", "Internet of Things"], correctOptionId: 0 },
    { question: "Q6: Artificial Intelligence ka avishkar kis ne kiya?", options: ["Alan Turing", "Elon Musk", "Mark Zuckerberg", " Bill Gates"], correctOptionId: 0 },
],
  2: [
    { question: "Q1: AI ka full form kya hai?", options: ["Artificial Intelligence", "Active Intelligence", "Advanced Integration", "Automated Intelligence"], correctOptionId: 0 },
    { question: "Q2: AI ka pramukh uddeshya kya hota hai?", options: ["Machine ko human jaise decision lene mein madad karna", "Machine ko zyada power dena", "Machine ko sirf data store karna sikhana", "Machine ko robots banane mein madad karna"], correctOptionId: 0 },
    { question: "Q3: AI ka upyog kis kshetra mein sabse zyada ho raha hai?", options: ["Healthcare", "Krishi", "Vyapar", "Shiksha"], correctOptionId: 0 },
  ],
 3: [
    { question: "Q1: ChatGPT ka full form kya hai?", options: ["Chat General Processing Tool", "Chat Generative Pre-trained Transformer", "Chat Graph Processing Technology", "Chat Global Processing Transformer"], correctOptionId: 1 },
    { question: "Q2: ChatGPT kis company ne develop kiya hai?", options: ["Microsoft", "Google", "OpenAI", "IBM"], correctOptionId: 2 },
   { question: "Q3: ChatGPT kis prakar ki AI technology ka use karta hai?", options: ["Natural Language Processing (NLP)", "Virtual Reality (VR)", "Augmented Reality (AR)", "Robotics"], correctOptionId: 0 }, 
   { question: "Q4. ChatGPT ka pramukh upyog kis cheez ke liye hota hai?", options: ["Data storage", "Language translation", "Human-like conversation", "Gaming"], correctOptionId: 2 },
],
  4: [
    { question: "Q1: Netlify par account banane ke liye sabse pehla step kya hai?", options: ["Netlify ki website par jana" , "GitHub download karna", "Browser refresh karna", "Phone restart karna"], correctOptionId: 0 },
   { question: "Q2: Netlify par kaun-kaun se account se sign up kar sakte hain?", options: ["GitHub" , "Google", "Email", "Sabhi"], correctOptionId: 3  },
  { question: "Netlify kis cheez ke liye sabse zyada use hota hai?", options: ["Online gaming" , "Website hosting", "Video editing", "Mobile apps banane ke liye"], correctOptionId: 1 },
   { question: "Q4: Netlify par account banane ke baad sabse pehla kaam kya hota hai?", options: ["Naya project banana ya website deploy karna" , "Computer band karna", "Instagram kholna", "Account delete karna"], correctOptionId: 0 },
  ], 
5: [
   {  question: "Q1: Netlify pe project deploy karne ke liye sabse pehle kya karna padta hai?", options: ["Kuch bhi nahi" , "Mobile restart karna", "ZIP file download karna", "Netlify ko uninstall karna"], correctOptionId: 2}, 
 { question: "Q2: Netlify website pe 'Browse to upload' button kis liye hota hai?", options: ["Game khelne ke liye", "Movie download karne ke liye", "ZIP file upload karne ke liye", "Website close karne ke liye"], correctOptionId: 2 },
 { question: "Q3: Netlify project deploy hone ke baad hume kya milta hai?", options: ["Free recharge", "Ek live project link", "Error message", "Certificate"], correctOptionId: 1 },
], 
6: [
   {  question: "Q1: Telegram bot banane ke liye sabse pehle kya karna padta hai?", options: ["Node.js install karna" , "Telegram kholo aur BotFather search karo", "VS Code download karo", "Naya Gmail banao"], correctOptionId: 1}, 
 { question: "Q2: BotFather ko bot banane ke liye kaunsi command bhejni hoti hai?", options: ["/start", "/createbot", "/newbot", "/addbot"], correctOptionId: 2 },
 { question: "Q3: /newbot bhejne ke baad BotFather kya poochta hai?", options: ["Telegram username", "Email ID", "Phone number", "Bot ka naam"], correctOptionId: 3 },
{ question: "Q4: Bot ka username kaisa hona chahiye?", options: ["_admin se end ho", "Real name ho", "bot se end ho", "Number hona chahiye"], correctOptionId: 2 },
{ question: "Q5: Bot banne ke baad BotFather kya deta hai?", options: ["Password", "Login link", "API token", "Invite code"], correctOptionId: 2 },
], 
7: [
   {  question: "Q1: Telegraf kis kaam aata hai?", options: ["WhatsApp bot" , "Telegram bot", "Discord bot", "Instagram API"], correctOptionId: 1}, 
 { question: "Q2: Bot ko connect karne ke liye kya chahiye?", options: ["Username", "Password", "API token", "Number"], correctOptionId: 2 },
 { question: "Q3: ctx.from me kya milta hai?", options: ["Bot ka naam", "User ki ID & naam", "Speed", "Sabka chat"], correctOptionId: 1 },
{ question: "Q4: hi msg pe reply chahiye, to kya likhenge?", options: ["bot.command", "bot.reply", "bot.hears", "bot.listen"], correctOptionId: 2 },
{ question: "Q5: Nodemon kyun use hota hai?", options: ["Password", "API banane", "Auto restart", "Live karne"], correctOptionId: 3 },
], 
};


// Define YouTube Video Links and Thumbnails for Each Level
const levelVideos = {
  1: {
    videoLink: "https://youtu.be/g2BDiSq6jNQ?si=6-bWGq7PcitXM_Rv", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/vFtnWt3dq8U/maxresdefault.jpg", // Replace with thumbnail URL
  },
 2: {
    videoLink: "https://youtu.be/M1ULmCG0pGg?si=0j4WDlW6S3r3yoaI", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/P5cgwMkBsUI/maxresdefault.jpg", // Replace with thumbnail URL
  },
  3: {
    videoLink: "https://youtu.be/yjkBHP0XTwM?si=MkwmUQ6GJfcDRkSC", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/DAgs1P67FrQ/maxresdefault.jpg", // Replace with thumbnail URL
  },
  4: {
    videoLink: "https://youtu.be/yVfS7kTi09c?si=5HQzQgevoNpCnBXi", 
    thumbnail: "https://img.youtube.com/vi/yVfS7kTi09c/maxresdefault.jpg", // Replace with thumbnail URL
  }, 
 5: {
    videoLink: "https://youtu.be/1owzVs2glkk?si=jDNU-7KGBNT0Wb59", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/1owzVs2glkk/maxresdefault.jpg", // Replace with thumbnail URL
  },
6: {
    videoLink: "https://youtu.be/LR6Plo7IicM?si=g4gqBw_3LL2JHoX0", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/LR6Plo7IicM/maxresdefault.jpg", // Replace with thumbnail URL
  },
7: {
    videoLink: "https://youtu.be/Gs6SYyD-gSs?si=QKshTSmY9rFVJbdl", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/Gs6SYyD-gSs/maxresdefault.jpg", // Replace with thumbnail URL
  },
};

// Function to Start a Level (Send Video First)
async function startLevel(ctx, user) {
  const level = user.level;

  if (levelVideos[level]) {
    const video = levelVideos[level];

    // Send thumbnail image with "Watch Video" button
    await bot.telegram.sendPhoto(user.telegramId, video.thumbnail, {
      caption: `📹 es video ko dhiyan se dekhe eske baad quiz suru kogi Level ${level -1}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Watch Video", url: video.videoLink }
          ]
        ]
      }
    });

    // Wait for 10 seconds before starting the quiz
    setTimeout(async () => {
      await sendNextPoll(ctx, user);
    }, 1000);
  } else {
    await sendNextPoll(ctx, user);
  }
}

// Function to Send the Next Poll
async function sendNextPoll(ctx, user) {
  const level = user.level;
  const polls = levelPolls[level];

  if (!polls || user.currentPollIndex >= polls.length) {
    if (level < Object.keys(levelPolls).length) {
      await bot.telegram.sendMessage(
        user.telegramId,
        `🎉 You completed Level ${level-1}!`,
        Markup.inlineKeyboard([
          Markup.button.callback("Next Level", `continue_${level + 1}`),
          Markup.button.callback("Change Level", "change_level"),
        ])
      );
    } else {
      await bot.telegram.sendMessage(
     user.telegramId,
 `अभी बस इतने ही लेवल्स हैं 😜. लेकिन हम जल्दी ही अगला लेवल upload करेंगे.

 नया level upload होने का नोटिफिकेशन चाहिए तो click करें 👇

        https://t.me/+IdDn8SaqValhZjQ1

जब लेवल अपलोड हो जाएगा तो /start  कमांड भेजें।

`,
);
      user.completed = true;
      await user.save();
    }
    return;
  }

  const poll = polls[user.currentPollIndex];

  await bot.telegram.sendPoll(user.telegramId, poll.question, poll.options, {
    type: "quiz",
    correct_option_id: poll.correctOptionId,
    is_anonymous: false,
  });
}

// Start Command
bot.start(async (ctx) => {
  const { id, username, first_name, last_name } = ctx.from;
 
    const from = ctx.update.message.from
    console.log('from',from)
  try {
    let user = await User.findOne({ telegramId: id });

    if (!user) {
      user = new User({
        telegramId: id,
        username: username || "N/A",
        firstName: first_name || "N/A",
        lastName: last_name || "N/A",
        level: 1,
        currentPollIndex: 0,
      });
      await user.save();

      // Ask the user for their mobile number
      await ctx.reply("Welcome to the quiz! Please provide your mobile number:");
    } else {
      await ctx.reply(`Welcome back! Resuming Level ${user.level-1}.`);
    }

    await startLevel(ctx, user);
  } catch (err) {
    console.error("Error in start command:", err);
    ctx.reply("An error occurred.");
  }
});

// Handle user's mobile number input
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });

  // If the user is not found or mobile number is already saved, return
  if (!user || user.mobileNumber) return;

  // Save the user's mobile number
  user.mobileNumber = ctx.message.text;
  await user.save();

  await ctx.reply("Thank you! Your mobile number has been saved.");
});

// Handle Poll Answers
bot.on("poll_answer", async (ctx) => {
  try {
    const telegramId = ctx.pollAnswer.user.id;
    const userDoc = await User.findOne({ telegramId });

    if (!userDoc) return;

    const level = userDoc.level;
    const polls = levelPolls[level];

    if (!polls || userDoc.currentPollIndex >= polls.length) {
      return;
    }

    const selectedOptionId = ctx.pollAnswer.option_ids[0];
    const correctOptionId = polls[userDoc.currentPollIndex].correctOptionId;

    if (selectedOptionId === correctOptionId) {
      userDoc.currentPollIndex += 1;
      await userDoc.save();
    }

    if (userDoc.currentPollIndex < polls.length) {
      await sendNextPoll(ctx, userDoc);
    } else {
      await bot.telegram.sendMessage(
        telegramId,
        `🎉 Level ${level-1} completed!`,
        Markup.inlineKeyboard([
          Markup.button.callback("Next Level", `continue_${level + 1}`),
          Markup.button.callback("Change Level", "change_level"),
        ])
      );
    }
  } catch (err) {
    console.error("Error handling poll answer:", err);
  }
});

// Handle Callback Queries
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  try {
    let user = await User.findOne({ telegramId });

    if (!user) return ctx.reply("Please start the bot first using /start.");

    if (data.startsWith("continue_")) {
      const nextLevel = parseInt(data.split("_")[1], 10);

      user.level = nextLevel;
      user.currentPollIndex = 0;
      await user.save();

      await ctx.answerCbQuery();
      await bot.telegram.sendMessage(telegramId, `🎯 Starting Level ${nextLevel-1}!`);
      await startLevel(ctx, user);
    }

    if (data === "change_level") {
      await ctx.reply(
        "Select a level to change to:",
        Markup.inlineKeyboard([
          Markup.button.callback("L-0", "change_to_1"),
          Markup.button.callback("L-1", "change_to_2"),
          Markup.button.callback("L-2", "change_to_3"), 
          Markup.button.callback("L-3", "change_to_4"), 
         Markup.button.callback("L-4", "change_to_5"), 
         Markup.button.callback("L-5", "change_to_6"), 
Markup.button.callback("L-6", "change_to_7"), 
        ])
      );
    }

    if (data.startsWith("change_to_")) {
      const newLevel = parseInt(data.split("_")[2], 10);

      user.level = newLevel;
      user.currentPollIndex = 0;
      await user.save();

      await ctx.answerCbQuery();
      await bot.telegram.sendMessage(telegramId, `🔄 Switched to Level ${newLevel-1}!`);
      await startLevel(ctx, user);
    }
  } catch (err) {
    console.error("Error in callback query:", err);
    ctx.reply("An error occurred.");
  }
});


// Start the bot
bot.launch().catch((err) => console.error("Error starting bot:", err)); 
