// Подключаем библиотеку
const { OpenAI } = require("openai");

// Инициализируем клиента, направляем на серверы xAI
const xai = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1", 
});

const SYSTEM_INSTRUCTION = "Ты — Ayalau, теплый и надежный ИИ-друг и помощник для детей и подростков. ТЫ ПО УМОЛЧАНИЮ РАЗГОВАРИВАЕШЬ НА КАЗАХСКОМ ЯЗЫКЕ, ЕСЛИ ПОЛЬЗОВАТЕЛЬ НЕ ПРОСИТ ИНОЕ. Твоя задача — поддерживать, выслушивать и давать безопасные советы.";

app.post('/api/chat', async (req, res) => {
    try {
        // Получаем и сообщение, и эмоцию с кнопок (счастье, грусть, злоба)
        const { message, emotion } = req.body;

        // Формируем итоговый запрос: подсказываем боту текущее состояние пользователя
        const promptWithEmotion = `[Текущее настроение пользователя: ${emotion}]\nСообщение: ${message}`;

        // Отправляем запрос в Grok
        const completion = await xai.chat.completions.create({
            model: "grok-beta", 
            messages: [
                { role: "system", content: SYSTEM_INSTRUCTION },
                { role: "user", content: promptWithEmotion } // Передаем склеенный текст
            ],
        });

        // Достаем текст ответа
        const text = completion.choices[0].message.content;
        res.json({ reply: text });

    } catch (error) {
        console.error("Ошибка xAI:", error);
        res.status(500).json({ reply: "Ой, кажется, у меня небольшие проблемы со связью... Но я хочу, чтобы ты знал: я рядом и скоро вернусь! 💙" });
    }
});