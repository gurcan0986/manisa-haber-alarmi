
import express from "express";
import cors from "cors";
import Parser from "rss-parser";
import { Expo } from "expo-server-sdk";

const app = express();
const parser = new Parser();
const expo = new Expo();

app.use(cors());
app.use(express.json());

const PORT = 3000;
const pushTokens = new Set();
const deviceDistricts = new Map();

let knownNewsKeys = null;

const RSS_SOURCES = [
  {
    name: "Manisa",
    district: "Manisa",
    url: "https://news.google.com/rss/search?q=Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Ahmetli",
    district: "Ahmetli",
    url: "https://news.google.com/rss/search?q=Ahmetli%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Akhisar",
    district: "Akhisar",
    url: "https://news.google.com/rss/search?q=Akhisar%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Alasehir",
    district: "Alasehir",
    url: "https://news.google.com/rss/search?q=Alasehir%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Demirci",
    district: "Demirci",
    url: "https://news.google.com/rss/search?q=Demirci%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Golmarmara",
    district: "Golmarmara",
    url: "https://news.google.com/rss/search?q=Golmarmara%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Gordes",
    district: "Gordes",
    url: "https://news.google.com/rss/search?q=Gordes%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Kirkagac",
    district: "Kirkagac",
    url: "https://news.google.com/rss/search?q=Kirkagac%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Koprubasi",
    district: "Koprubasi",
    url: "https://news.google.com/rss/search?q=Koprubasi%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Kula",
    district: "Kula",
    url: "https://news.google.com/rss/search?q=Kula%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Salihli",
    district: "Salihli",
    url: "https://news.google.com/rss/search?q=Salihli%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Sarigol",
    district: "Sarigol",
    url: "https://news.google.com/rss/search?q=Sarigol%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Saruhanli",
    district: "Saruhanli",
    url: "https://news.google.com/rss/search?q=Saruhanli%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Selendi",
    district: "Selendi",
    url: "https://news.google.com/rss/search?q=Selendi%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Soma",
    district: "Soma",
    url: "https://news.google.com/rss/search?q=Soma%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Sehzadeler",
    district: "Sehzadeler",
    url: "https://news.google.com/rss/search?q=Sehzadeler%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Turgutlu",
    district: "Turgutlu",
    url: "https://news.google.com/rss/search?q=Turgutlu%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
  {
    name: "Yunusemre",
    district: "Yunusemre",
    url: "https://news.google.com/rss/search?q=Yunusemre%20Manisa&hl=tr&gl=TR&ceid=TR:tr",
  },
];

async function getNews() {
  const allNews = [];

  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);

      for (const item of feed.items) {
        allNews.push({
          title: item.title || "",
          link: item.link || "",
          date: item.pubDate || item.isoDate || "",
          source: source.name,
          district: source.district,
        });
      }
    } catch (error) {
      console.log("Kaynak okunamadi:", source.name);
    }
  }

  const unique = [];
  const seen = new Set();

  for (const item of allNews) {
    const key = (item.link || item.title).toLowerCase().trim();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  unique.sort((a, b) => {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return unique;
}

async function sendPushNotification(title, body, newsDistrict) {
  const messages = [];

  for (const token of pushTokens) {
    const targetDistricts = deviceDistricts.get(token) || ["Manisa"];

    const matchesDistrict =
      targetDistricts.includes("Manisa") ||
      targetDistricts.some(
        (district) =>
          String(district).toLocaleLowerCase("tr-TR") ===
          String(newsDistrict || "Manisa").toLocaleLowerCase("tr-TR")
      );

    if (!matchesDistrict) {
      continue;
    }

    if (!Expo.isExpoPushToken(token)) {
      console.log("Gecersiz bildirim tokeni:", token);
      continue;
    }

    messages.push({
      to: token,
      sound: "default",
      title,
      body,
    });
  }

  if (messages.length === 0) {
    console.log("Bu haber icin bildirim alacak cihaz yok.");
    return;
  }

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log("Bildirim sonucu:", tickets);
    } catch (error) {
      console.error("Bildirim gonderilemedi:", error);
    }
  }
}

app.post("/register-token", (req, res) => {
  const { token, district, districts } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({
      success: false,
      message: "Gecerli bildirim tokeni gerekli.",
    });
  }

  if (!Expo.isExpoPushToken(token)) {
    return res.status(400).json({
      success: false,
      message: "Bildirim tokeni Expo formatinda degil.",
    });
  }

  const selectedDistricts = Array.isArray(districts)
    ? districts.filter((item) => typeof item === "string")
    : [district || "Manisa"];

  const finalDistricts =
    selectedDistricts.length > 0 ? selectedDistricts : ["Manisa"];

  pushTokens.add(token);
  deviceDistricts.set(token, finalDistricts);

  console.log("Cihaz ilce tercihleri:", finalDistricts);

  return res.json({
    success: true,
    message: "Bildirim kaydi alindi.",
  });
});

async function checkForNewNews() {
  try {
    const news = await getNews();

    const currentKeys = new Set(
      news.map((item) => item.link || item.title)
    );

    if (knownNewsKeys === null) {
      knownNewsKeys = currentKeys;
      console.log("Ilk haber kontrolu tamamlandi.");
      return;
    }

    const newItems = news.filter(
      (item) => !knownNewsKeys.has(item.link || item.title)
    );

    knownNewsKeys = currentKeys;

    for (const item of newItems.slice(0, 3)) {
      await sendPushNotification(
        "Manisa Haber Alarmi",
        item.title || "Yeni haber yayimlandi.",
        item.district || "Manisa"
      );
    }

    if (newItems.length > 0) {
      console.log("Yeni haber sayisi:", newItems.length);
    } else {
      console.log("Yeni haber bulunamadi.");
    }
  } catch (error) {
    console.error("Otomatik haber kontrolu basarisiz:", error);
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Manisa Haber Alarmi sunucusu calisiyor",
  });
});

app.get("/news", async (req, res) => {
  try {
    const news = await getNews();

    res.json({
      success: true,
      count: news.length,
      news,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Haberler alinamadi",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Manisa Haber Alarmi server ${PORT} portunda calisiyor`);
}); {
  console.log("Manisa Haber Alarmi server calisiyor:");
  console.log("http://localhost:" + PORT);

  checkForNewNews();
  setInterval(checkForNewNews, 60 * 1000);
});
