const { getDb } = require('../database/db');
const config = require('../config');

function getSetting(key, defaultValue) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function fillTemplate(template, lead) {
  const demoLink = lead.niche === 'dental' ? config.dentalDemoLink : config.demoLink;
  const demoLink2 = lead.niche === 'dental' ? config.dentalDemoLink2 : '';
  return template
    .replace(/{name}/g, lead.name || 'there')
    .replace(/{company}/g, lead.company || 'your company')
    .replace(/{city}/g, lead.city || 'your area')
    .replace(/{demo_link}/g, demoLink)
    .replace(/{demo_link2}/g, demoLink2);
}

function getInitialTemplate(lead) {
  const niche = lead.niche || 'cleaning';
  const template = getSetting(niche + '_initial_template',
    niche === 'dental'
      ? `Hi {name},

I came across {company} in {city} and noticed your online presence could use some improvement.

We recently built a modern dental website that's helping a clinic get significantly more online bookings and patient inquiries — check it out: {demo_link2}

Here's another example we designed: {demo_link}

Would you be open to a quick chat about what we could do for {company}?

Best,
Nito`
      : `Hi {name},

I came across {company} in {city} and noticed you might not have a website yet.

We recently built a professional cleaning service website that's been helping them get significantly more online bookings — check it out: {demo_link}

Would you be open to a quick chat about what we could do for {company}?

Best,
Nito`
  );
  return fillTemplate(template, lead);
}

function getFollowup1Template(lead) {
  const niche = lead.niche || 'cleaning';
  const template = getSetting(niche + '_followup1_template',
    niche === 'dental'
      ? `Hey {name},

Just following up on my last message. I'd love to show you what a professional dental website could do for {company}'s patient growth in {city}.

The latest project is still live at {demo_link2} — and we have another at {demo_link}. Let me know if you're interested.

Best,
Nito`
      : `Hey {name},

Just following up on my last message. I'd love to show you what a professional website could do for {company}'s growth in {city}.

The demo is still live at {demo_link} — let me know if you're interested.

Best,
Nito`
  );
  return fillTemplate(template, lead);
}

function getFollowup2Template(lead) {
  const niche = lead.niche || 'cleaning';
  const template = getSetting(niche + '_followup2_template',
    niche === 'dental'
      ? `Hi {name},

Wanted to reach out one more time. We have capacity next week to start on new projects, and I think {company} could really benefit from a modern website that attracts more patients.

Check out our latest work: {demo_link2} — and another example here: {demo_link}

Let me know,
Nito`
      : `Hi {name},

Wanted to reach out one more time. We have capacity next week to start on new projects, and I think {company} could really benefit from a modern website.

Check out the demo: {demo_link}

Let me know,
Nito`
  );
  return fillTemplate(template, lead);
}

function getClosingTemplate(lead) {
  const niche = lead.niche || 'cleaning';
  const template = getSetting(niche + '_closing_template',
    niche === 'dental'
      ? `Last message from me, {name}.

If you ever want to grow {company} online with a professional dental website, feel free to reach out anytime. Wishing you all the best.

Demos: {demo_link2} / {demo_link}

Cheers,
Nito`
      : `Last message from me, {name}.

If you ever want to grow {company} online with a professional website, feel free to reach out anytime. Wishing you all the best.

Demo: {demo_link}

Cheers,
Nito`
  );
  return fillTemplate(template, lead);
}

function getInstagramTemplate(lead) {
  const niche = lead.niche || 'cleaning';
  const template = getSetting(niche + '_instagram_template',
    niche === 'dental'
      ? `Hey {name}! 👋

I came across {company} and saw your online presence could use a refresh. We've built dental clinic websites like these — check them out:
{demo_link2}
{demo_link}

Would love to help {company} attract more patients online. Let me know! 🙌`
      : `Hey {name}! 👋

I came across {company} and saw you guys don't have a website yet. We just built this cleaning site for a client — check it out: {demo_link}

Would love to help {company} get online and start getting more bookings. Let me know! 🙌`
  );
  return fillTemplate(template, lead);
}

function getTemplateForStep(step, lead) {
  const niche = lead.niche || 'cleaning';
  const label = config.nicheLabels[niche] || 'business';
  const subjects = {
    0: [
      `Quick question about {company}'s website`,
      `Saw {company} in {city} — quick question`,
      `Question about your ${label} in {city}`,
      `Mind if I ask you something about {company}?`,
    ],
    1: [
      `Re: Quick question about {company}'s website`,
      `Re: Saw {company} in {city} — quick question`,
      `Re: Question about your ${label} in {city}`,
      `Re: Mind if I ask you something about {company}?`,
    ],
    2: [
      `Re: Quick question about {company}'s website`,
      `Re: Saw {company} in {city} — quick question`,
      `Re: Question about your ${label} in {city}`,
      `Re: Mind if I ask you something about {company}?`,
    ],
    3: [
      `Re: Quick question about {company}'s website`,
      `Re: Saw {company} in {city} — quick question`,
      `Re: Question about your ${label} in {city}`,
      `Re: Mind if I ask you something about {company}?`,
    ],
  };

  const variants = subjects[step] || subjects[0];
  const idx = (lead.id || Math.floor(Math.random() * 4)) % variants.length;
  const subject = variants[idx]
    .replace(/{company}/g, lead.company || 'your company')
    .replace(/{city}/g, lead.city || 'your area')
    .replace(/{label}/g, label);

  let body;
  switch (step) {
    case 0: body = getInitialTemplate(lead); break;
    case 1: body = getFollowup1Template(lead); break;
    case 2: body = getFollowup2Template(lead); break;
    case 3: body = getClosingTemplate(lead); break;
    default: body = '';
  }

  return { subject, body };
}

module.exports = { getTemplateForStep, getInstagramTemplate };
