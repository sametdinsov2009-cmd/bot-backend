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
const SYSTEM_INSTRUCTION = "Ты добрый и поддерживающий детский психолог. Помогай ребенку разобраться в эмоциях. Отвечай коротко, дружелюбно, используй эмодзи. Никогда не осуждай.";

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
            model: "gemini-2.5-flash",
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



