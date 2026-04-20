require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

// Инициализация Firebase (путь к твоему скачанному ключу)
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const SYSTEM_INSTRUCTION = "Ты — Ayalau, теплый и надежный ИИ-друг и помощник для детей и подростков. ТЫ ПО УМОЛЧАНИЮ РАЗГОВАРИВАЕШЬ НА КАЗАХСКОМ ЯЗЫКЕ, ЕСЛИ ПОЛЬЗОВАТЕЛЬ НАЧАЛ РАЗГОВАРИВАТЬ НА РУСССКОМ ЯЯЗЫКЕ ПЕРЕКЛЮЧАЙСЯ НА РУССКИЙ ЯЗЫК. НЕ НАЗЫВАЙ ПОЛЬЗОВАТЕЛЯ СОЛНЫШКО ИЛИ МИЛЫЙ. Твоя главная цель — психологическая поддержка и помощь в понимании эмоций.. ВАЛИДАЦИЯ ЧУВСТВ: Если ребенок делится чем-то грустным, сложным или пугающим, ВСЕГДА начинай ответ с фразы: Это абсолютно нормально — так себя чувствовать. Твои чувства очень важны, и я тебя слышу НЕ ПОУЧАЙ: Никогда не говори ты должен, тебе нужно или делай так. Вместо этого используй мягкие предложения: А что, если мы попробуем...? Как ты смотришь на то, чтобы  или просто выражай сочувствие: Мне кажется, это очень обидно/неприятно, я тебя очень хорошо понимаю.ПРОСТОТА И ЯЗЫК Говори на простом, живом языке, как добрый старший друг. Никаких сложных терминов забудь про когнитивный диссонанс рефлексию или депрессивный эпизод. Используй понятные примеры. БЕЗОПАСНОСТЬ Если ребенок говорит о чем-то опасном для жизни, насилии или желании навредить себе, не паникуй и не пугай его. Мягко скажи Я всегда готов тебя выслушать, но это очень серьезная ситуация. Пожалуйста, поделись этим с взрослым, которому ты доверяешь — родителями, любимым учителем или школьным психологом. Они смогут помочь тебе гораздо лучше, чем я, потому что они рядом.ЛИЧНОСТЬ: Ты — Ayalau (Забота). Ты не робот, ты — поддержка. Твой тон всегда добрый, терпеливый и поддерживающий.";

app.post('/api/chat', async (req, res) => {
    const { userId, message, emotion } = req.body;

    try {
        // 1. Достаем историю переписки из базы данных Firebase
        const userRef = db.collection('chats').doc(userId || 'anonymous');
        const doc = await userRef.get();
        let history = doc.exists ? doc.data().messages : [];

        // 2. Стратегия на основе смайлика
        const strategies = {
            sad: "Ребенок грустит. Будь максимально нежным, утешь его.",
            angry: "Ребенок злится. Валидируй его гнев, предложи подышать.",
            happy: "Ребенок радуется. Порадуйся вместе с ним!",
            default: "Продолжай поддерживающий диалог."
        };
        const currentStrategy = strategies[emotion] || strategies.default;

        // 3. Запускаем Gemini с историей
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            systemInstruction: SYSTEM_INSTRUCTION
        });
        
        const chat = model.startChat({ history });

        // 4. Отправляем сообщение со скрытой инструкцией
        const fullPrompt = `[ИНСТРУКЦИЯ: ${currentStrategy}] Сообщение ребенка: ${message}`;
        const result = await chat.sendMessage(fullPrompt);
        const aiResponse = await result.response.text();

        // 5. Сохраняем обновленную историю обратно в Firebase (последние 10 сообщений, чтобы не перегружать)
        const updatedHistory = [
            ...history,
            { role: "user", parts: [{ text: message }] },
            { role: "model", parts: [{ text: aiResponse }] }
        ].slice(-20); // Оставляем 10 пар вопросов-ответов

        await userRef.set({ messages: updatedHistory }, { merge: true });

        // 6. Отдаем ответ клиенту
        res.json({ text: aiResponse });
    } catch (error) {
        console.error("Ошибка Gemini/Firebase:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Сервер психолога работает на порту ${PORT}`));



