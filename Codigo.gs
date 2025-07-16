/**
 * @OnlyCurrentDoc
 *
 * Script central para o site da Dra. Ana Paula Braga.
 * Inclui roteamento de páginas, busca de posts para o blog,
 * agendamento de consultas via Google Agenda e processamento de formulário de contato.
 */

// =================================================================
// CONFIGURAÇÕES GLOBAIS
// =================================================================

const CONFIG = {
  blog: {
    spreadsheetId: '1TwQdM4u7O7T7En9iU7XTM4PCEcFLuM4kpVyJacNXpdE', // <-- IMPORTANTE: Substitua pelo ID da sua Planilha Google com os posts
    sheetName: 'posts',
    postsPerPage: 3 // Quantos artigos serão exibidos por página no blog
  },
  calendar: {
    calendarId: 'f0b4fd2f4ff4514d14c7f0f3962d995fabf07cfb2698df96978e71bbe114ecc2@group.calendar.google.com',
    appointmentDurationMinutes: 60,
    daysToSearch: 14,
    workHours: {
      start: 13,
      startMinutes: 30,
      end: 19,
      workDays: [1, 2, 3, 4, 5] // Segunda a Sexta
    }
  },
  contact: {
    recipientEmail: 'eduu@live.in' // <-- IMPORTANTE: Substitua pelo e-mail que receberá as mensagens do formulário
  }
};

// =================================================================
// FUNÇÃO PRINCIPAL (ROTEADOR WEB APP)
// =================================================================

/**
 * Função principal que serve o conteúdo do site.
 * Roteia as solicitações com base no parâmetro 'page' da URL.
 */
function doGet(e) {
  var page = e.parameter.page || 'home'; 
  var title = "Dra. Ana Paula Braga - Psiquiatra";
  var template;

  switch (page) {
    case 'blog':
      const pageNumber = parseInt(e.parameter.p) || 1;
      const blogData = getPosts(pageNumber);
      
      template = HtmlService.createTemplateFromFile('blog');
      template.posts = blogData.posts;
      template.currentPage = blogData.currentPage;
      template.totalPages = blogData.totalPages;
      title = "Blog - Dra. Ana Paula Braga";
      break;
      
    case 'post1':
      template = HtmlService.createTemplateFromFile('post1');
      title = "A Importância do Autocuidado - Dra. Ana Paula Braga";
      break;
    case 'post2':
      template = HtmlService.createTemplateFromFile('post2');
      title = "Desmistificando a Ansiedade - Dra. Ana Paula Braga";
      break;
    case 'post3':
      template = HtmlService.createTemplateFromFile('post3');
      title = "Terapia e Medicação - Dra. Ana Paula Braga";
      break;
      
    default: // 'home' ou qualquer outro valor
      template = HtmlService.createTemplateFromFile('index');
      break;
  }
  
  // Passa a URL base para todos os templates, permitindo links dinâmicos
  template.baseUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =================================================================
// SEÇÃO DO BLOG - LÓGICA DE DADOS
// =================================================================

/**
 * Busca posts da planilha com suporte para paginação.
 * @param {number} pageNumber - O número da página a ser buscada.
 * @returns {object} Contendo a lista de posts, a página atual e o total de páginas.
 */
function getPosts(pageNumber = 1) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.blog.spreadsheetId).getSheetByName(CONFIG.blog.sheetName);
    const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const publishedPosts = allData.map(row => {
      let post = {};
      headers.forEach((header, index) => {
        post[header] = row[index] instanceof Date ? row[index].toISOString().split('T')[0] : row[index];
      });
      return post;
    }).filter(post => post.status === 'published')
      .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));

    const totalPages = Math.ceil(publishedPosts.length / CONFIG.blog.postsPerPage);
    const startIndex = (pageNumber - 1) * CONFIG.blog.postsPerPage;
    const postsForPage = publishedPosts.slice(startIndex, startIndex + CONFIG.blog.postsPerPage);

    return { posts: postsForPage, currentPage: pageNumber, totalPages: totalPages };
  } catch (error) {
    console.error("Erro ao buscar posts: " + error.toString());
    return { posts: [], currentPage: 1, totalPages: 1 };
  }
}

// =================================================================
// SEÇÃO DE AGENDAMENTO VIA GOOGLE AGENDA
// =================================================================

/**
 * Busca e retorna uma lista de horários disponíveis.
 * @returns {string[]} Lista de horários disponíveis no formato ISO.
 */
function getAvailableSlots() {
  try {
    const calendar = CalendarApp.getCalendarById(CONFIG.calendar.calendarId);
    const scriptTimeZone = Session.getScriptTimeZone();
    
    const now = new Date();
    const searchEndDate = new Date(now.getTime() + (CONFIG.calendar.daysToSearch * 24 * 60 * 60 * 1000));
    const busyTimes = calendar.getEvents(now, searchEndDate).map(e => ({ start: e.getStartTime().getTime(), end: e.getEndTime().getTime() }));
    
    const availableSlots = [];
    let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 0; i < CONFIG.calendar.daysToSearch; i++) {
      if (CONFIG.calendar.workHours.workDays.includes(currentDate.getDay())) {
        const workDayStartStr = Utilities.formatDate(currentDate, scriptTimeZone, `yyyy-MM-dd'T'${CONFIG.calendar.workHours.start}:${CONFIG.calendar.workHours.startMinutes}:00`);
        const workDayEndStr = Utilities.formatDate(currentDate, scriptTimeZone, `yyyy-MM-dd'T'${CONFIG.calendar.workHours.end}:00:00`);
        
        let currentSlotStart = new Date(workDayStartStr);
        const workDayEnd = new Date(workDayEndStr);

        while (currentSlotStart.getTime() < workDayEnd.getTime()) {
          if (currentSlotStart.getTime() > now.getTime()) {
            const slotEnd = new Date(currentSlotStart.getTime() + CONFIG.calendar.appointmentDurationMinutes * 60 * 1000);
            if (!busyTimes.some(busy => (currentSlotStart.getTime() < busy.end) && (slotEnd.getTime() > busy.start))) {
              availableSlots.push(currentSlotStart.toISOString());
            }
          }
          currentSlotStart.setTime(currentSlotStart.getTime() + CONFIG.calendar.appointmentDurationMinutes * 60 * 1000);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return availableSlots;
  } catch (error) {
    console.error("Erro ao buscar horários: " + error.toString() + " Stack: " + error.stack);
    return [];
  }
}

/**
 * Cria um evento de agendamento na agenda, com trava de segurança.
 * @param {object} appointmentData - Dados do agendamento { name, email, time }.
 * @returns {object} Objeto de resposta com status de sucesso.
 */
function createAppointment(appointmentData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const calendar = CalendarApp.getCalendarById(CONFIG.calendar.calendarId);
    const startTime = new Date(appointmentData.time);

    if (calendar.getEventsForDay(startTime).some(e => e.getStartTime().getTime() === startTime.getTime())) {
      return { success: false, message: "Desculpe, este horário acabou de ser preenchido. Por favor, escolha outro." };
    }

    const endTime = new Date(startTime.getTime() + CONFIG.calendar.appointmentDurationMinutes * 60 * 1000);
    const eventTitle = `Consulta - ${appointmentData.name}`;
    const eventOptions = {
      description: `Agendamento via site.\nPaciente: ${appointmentData.name}\nEmail: ${appointmentData.email}`,
      guests: appointmentData.email,
      sendInvites: true
    };
    
    calendar.createEvent(eventTitle, startTime, endTime, eventOptions);
    return { success: true, message: "Agendamento confirmado com sucesso! Verifique seu e-mail." };
  } catch (error) {
    console.error("Erro ao criar agendamento: " + error.toString() + " Stack: " + error.stack);
    return { success: false, message: "Não foi possível realizar o agendamento. Tente novamente." };
  } finally {
    lock.releaseLock();
  }
}


// =================================================================
// SEÇÃO DO FORMULÁRIO DE CONTATO
// =================================================================

/**
 * Processa os dados do formulário de contato e envia um e-mail.
 * @param {object} formData - Dados do formulário { name, email, message }.
 * @returns {object} Objeto de resposta com status de sucesso.
 */
function processForm(formData) {
  try {
    const recipientEmail = CONFIG.contact.recipientEmail;
    const subject = `Nova mensagem do site de ${formData.name}`;
    const body = `Você recebeu uma nova mensagem através do site.\n\n` +
                 `Nome: ${formData.name}\n` +
                 `Email: ${formData.email}\n\n` +
                 `Mensagem:\n${formData.message}`;
                 
    MailApp.sendEmail(recipientEmail, subject, body);
    return { success: true, message: "Sua mensagem foi enviada com sucesso!" };
  } catch (error) {
    console.error("Erro no formulário de contato: " + error.toString());
    return { success: false, message: "Ocorreu um erro ao enviar sua mensagem." };
  }
}