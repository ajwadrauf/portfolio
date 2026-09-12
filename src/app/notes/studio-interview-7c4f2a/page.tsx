import type { Metadata } from "next";
import { InterviewPractice, PrintGuideButton } from "@/components/interview/InterviewPractice";
import { audienceQuestions, objections, phases, questions, roleMap, stories, strengths, walkthrough } from "./guideContent";
import styles from "./InterviewGuide.module.css";

export const metadata: Metadata = {
  title: "Interview notebook · Ajwad Rauf",
  description: "A personal notebook for preparation and practice.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

const sections = [
  ["start", "The central story"],
  ["role", "What this role needs"],
  ["strengths", "Five things I noticed"],
  ["story", "Your introduction"],
  ["walkthrough", "The portfolio walkthrough"],
  ["evidence", "Four stories to prepare"],
  ["hard-questions", "The difficult questions"],
  ["delivery", "Delivery & connection"],
  ["first-90-days", "Your first 90 days"],
  ["ask-them", "Questions for the room"],
  ["credibility", "Keep the claims honest"],
  ["practice", "Rehearse & make notes"],
];

function SectionHeading({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) {
  return <header className={styles.sectionHeading}><span className={styles.number}>{number}</span><div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2></div></header>;
}

export default function InterviewNotebook() {
  return (
    <div className={styles.page}>
      <a href="#start" className={styles.skipLink}>Skip to the guide</a>
      <header className={styles.hero}>
        <div className={styles.topline}><p className={styles.eyebrow}>Ajwad Rauf · personal interview notebook</p><span className={styles.date}>Prepared 12 September 2026</span></div>
        <div className={styles.heroGrid}>
          <div><p className={styles.roleLabel}>Internal opportunity · Director, AI Content Studio</p><h1>Make the work.<br />Make it repeatable.<br /><em>Help people do both.</em></h1><p className={styles.heroIntro}>A story you can stand behind, examples you can show, and space to find the words that sound like you.</p></div>
          <aside className={styles.heroNote}><p className={styles.eyebrow}>Your strongest position</p><p>You already know how to turn a messy production process into a working capability. You are now bringing that experience closer to the creative itself.</p><p className={styles.heroNoteSmall}>The interview needs evidence of both: the work you can make and the team you can help build.</p><a href="#practice">Go straight to rehearsal <span aria-hidden="true">↗</span></a></aside>
        </div>
        <div className={styles.heroActions}><PrintGuideButton /><a href="#walkthrough" className={styles.textLink}>Plan the portfolio walkthrough ↓</a></div>
        <p className={styles.visibilityNote}>Unlisted preparation page. It has no links from the public site and asks search engines not to index it. It is not password protected; anyone with this URL can open it.</p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}><nav aria-label="Interview guide sections"><p className={styles.eyebrow}>Find your place</p><ol>{sections.map(([id, label], i) => <li key={id}><a href={`#${id}`}><span>{String(i + 1).padStart(2, "0")}</span>{label}</a></li>)}</ol><p className={styles.sidebarNote}>Read once for the story.<br />Return for the practice.</p></nav></aside>
        <main className={styles.main}>
          <section id="start" className={styles.section}>
            <SectionHeading number="01" eyebrow="The thread to return to" title="You are moving closer to the work." />
            <p className={styles.lead}>The transition makes sense when you connect your production and enablement experience to a growing practice of making visual work. Lead with that connection.</p>
            <blockquote className={styles.pullQuote}>“I want to take more ownership of the creative work itself, while bringing the workflow discipline and team enablement that I already practise.”</blockquote>
            <p>Your strongest case is the combination: internal context, hands-on building, attention to the output, and an interest in helping other people use the capability. Fast learning supports that case when you can show what changed between an early attempt and a stronger result.</p>
            <p>Make the hands-on part of your case visible early. Show the output, explain one creative decision and connect it to how a team could repeat the work. Keep the discussion of your developing craft experience specific and proportionate.</p>
            <div className={styles.quickCard}><p className={styles.eyebrow}>If you have ten minutes before the interview</p><ol className={styles.numberedList}><li><strong>Remember the thread.</strong> Production experience → hands-on creative making → a repeatable team capability.</li><li><strong>Choose two pieces of evidence.</strong> One VELUNE decision and one real Project Forge or leadership example.</li><li><strong>Check playback.</strong> Film, original sound and voiceover. Keep a local backup ready.</li><li><strong>Bring one honest gap sentence.</strong> Acknowledge it once, without making it your whole introduction.</li><li><strong>Choose two questions for them.</strong> Ask about the work they need and what success would look like.</li><li><strong>Slow the first sentence.</strong> Make your point, give the example, stop and let them respond.</li></ol></div>
          </section>

          <section id="role" className={styles.section}>
            <SectionHeading number="02" eyebrow="Read the job as a set of decisions" title="They need a maker who can build a capability." />
            <p>The supplied description asks this Director to personally create content while establishing tools, intake, standards, team capability and production measurement alongside the Head of Production. Use your examples to answer those needs individually.</p>
            <div className={styles.roleMap}>{roleMap.map(([need, evidence, next], i) => <article key={need}><div className={styles.roleNeed}><span>{String(i + 1).padStart(2, "0")}</span><h3>{need}</h3></div><div><p>{evidence}</p><p className={styles.proofNote}><strong>Make it concrete:</strong> {next}</p></div></article>)}</div>
            <p className={styles.sourceNote}>This is an interpretation of the supplied job description, not inside knowledge of the panel’s scoring. Preparing specific examples against job competencies is consistent with the approach described by <a href="https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/">OPM’s structured-interview guidance</a>.</p>
            <div className={styles.note}><h3>What would make the case materially stronger?</h3><p>A small piece completed to a real delivery specification, with the source assets and finishing steps you can explain. The current VELUNE player demonstrates the supplied picture playing with separate audio. Be clear about whether you also have a mastered final file, and show only the finish you have actually completed.</p></div>
          </section>

          <section id="strengths" className={styles.section}>
            <SectionHeading number="03" eyebrow="Observed throughout our build" title="Five things that stand out about how you work." />
            <p className={styles.lead}>These are behaviors I saw in our collaboration. They give you specific evidence to bring into the room. They are not a ranking against candidates I have not met.</p>
            <div className={styles.strengths}>{strengths.map((strength, i) => <article className={styles.strengthCard} key={strength.title}><p className={styles.cardIndex}>Observation {String(i + 1).padStart(2, "0")}</p><h3>{strength.title}</h3><p>{strength.observation}</p><p><strong>Why it matters:</strong> {strength.meaning}</p><blockquote>{strength.line}</blockquote><p className={styles.proofNote}>{strength.watch}</p></article>)}</div>
            <p><strong>The distinguishing combination:</strong> you care about the frame, the person using the tool, and the handoff after the frame is made. Make that visible through examples instead of saying you use AI better than most people.</p>
          </section>

          <section id="story" className={styles.section}>
            <SectionHeading number="04" eyebrow="Use the structure, keep your own voice" title="A genuine introduction." />
            <p>These are drafts to adapt, not lines to memorize. Keep only the words and motivations that feel true to you.</p>
            <article className={styles.script}><p className={styles.eyebrow}>The short version · about 30 seconds</p><blockquote>“My background is in making production workflows work for people. At Loblaw, that has meant connecting intake, build, review and delivery, while helping teams use AI. I’ve started bringing that experience closer to the creative itself by building a personal studio and making work with it. This role interests me because it brings those things together: making strong content, building a dependable way to produce it, and helping a team develop the capability.”</blockquote></article>
            <article className={styles.script}><p className={styles.eyebrow}>The fuller story · about 90 seconds</p><blockquote><p>“The part of my work I’ve become most interested in is what happens between a good idea and getting it into production.</p><p>In my current role, I’ve worked on that through workflows, automation and AI enablement. With Project Forge, the part that mattered to me was giving people time back: less chasing, clearer readiness and a more dependable path from request to delivery.</p><p>AI has brought that interest closer to the creative itself. I wanted to understand the tools by making things, so I built a personal content studio on my own time and used it to develop product imagery and VELUNE. I learned a lot by reviewing what didn’t work, changing the references or direction, and following the result into sound and handoff.</p><p>That is why I want this move. I want to take more ownership of the work itself and help build a studio where other people can do it well too.</p><p>I’d bring the production experience I already have, stay personally involved in making the work, and learn from the craft already in the team. I want to help build a studio that can deliver strong content and give people a dependable way to keep improving it.”</p></blockquote></article>
            <div className={styles.twoColumn}><article className={styles.note}><h3>Why an internal move?</h3><p>“I already care about this business and the people doing the work. I’ve seen some of the friction around production, and I’d like to take on a role where I can connect that understanding more directly to creative delivery. I would come in with context, and still take time to understand the studio’s needs rather than assuming my current view is the whole picture.”</p><p className={styles.proofNote}>An internal panel may know your current title without knowing the full scope of your work. Give them that context. Speak positively about your current team and explain how you would hand over your responsibilities if asked.</p></article><article className={styles.note}><h3>How to show learning speed</h3><p>Replace “I learn exceptionally fast” with a sequence: what you could not do, how you learned it, what you produced, and what you can now repeat or teach.</p><p>Use actual dates if you have them. Pick a visible change in your capability, then explain how you checked that the result was better.</p></article></div>
            <div className={styles.darkNote}><p className={styles.eyebrow}>A line worth keeping</p><p>“The portfolio shows the work I made, the decisions behind it, and the studio I built to carry those decisions into the next brief.”</p></div>
          </section>

          <section id="walkthrough" className={styles.section}>
            <SectionHeading number="05" eyebrow="An eight-minute route" title="Give the portfolio a beginning, a decision and a payoff." />
            <p>Follow their agenda first. If invited to present, offer this short route. It lets the VELUNE film arrive after its setup, then connects the creative result to your production experience. Use these links to prepare tabs beforehand; during the interview, switch to those prepared tabs.</p>
            <ol className={styles.walkthrough}>{walkthrough.map((step) => <li key={step.time}><div className={styles.stepTop}><span className={styles.time}>{step.time}</span><a href={step.href} target="_blank" rel="noopener noreferrer">{step.link} ↗</a></div><h3>{step.title}</h3><p>{step.show}</p><blockquote>{step.say}</blockquote></li>)}</ol>
            <div className={styles.twoColumn}><article className={styles.note}><h3>If you only have 15 minutes</h3><p>Use roughly one minute to introduce yourself, five for one case and its workflow, six for discussion, and three for your questions. Drop the second case before rushing the first.</p></article><article className={styles.note}><h3>If you have 30 minutes</h3><p>Aim for two minutes of introduction, eight of demonstration, fifteen of discussion and five for questions. Treat this as a flexible plan, not a claim on their interview time.</p></article></div>
            <div className={styles.experiment}><p className={styles.eyebrow}>A more memorable moment · one brief, two lenses</p><h3>Show one imperfect frame and the decision it demanded.</h3><p>Keep a prepared before-and-after carton comparison beside the brief. In sixty seconds, explain the creative lens: the packaging stopped feeling like the same physical object. Then explain the production lens: appearance references and the camera guide needed clearer roles.</p><p>If the conversation allows it, ask: <strong>“Which part of the product would you protect most carefully across a whole campaign?”</strong> Listen and connect their answer to how you would review the next asset. This should feel like a working conversation, never a test for the panel.</p><p className={styles.proofNote}>Use the files you actually have. If a comparison is not ready, describe the decision beside the final frame. Do not reconstruct a fake earlier failure.</p></div>
            <p><strong>Have a graceful fallback:</strong> “The live page is taking a moment. I have the same example locally, so I’ll use that and keep us focused on the work.” Preload examples and use saved outputs. A live paid generation adds waiting time and unpredictable results without proving more about your judgment.</p>
          </section>

          <section id="evidence" className={styles.section}>
            <SectionHeading number="06" eyebrow="Prepare events, not adjectives" title="Four stories that can answer several questions." />
            <p>Start with a short point, describe the situation and your action, then give the outcome and lesson. Keep “I” for your decisions and “we” for the team’s contribution. <a href="https://careerservices.fas.harvard.edu/resources/interviewing/">Harvard’s interview guidance</a> recommends specific examples and practice that builds clarity rather than memorized responses.</p>
            <div className={styles.storyBank}>{stories.map((story, i) => <article className={styles.storyCard} key={story.title}><p className={styles.eyebrow}>Story {i + 1} · {story.source}</p><h3>{story.title}</h3><dl><dt>Situation</dt><dd>{story.situation}</dd><dt>Your action</dt><dd>{story.action}</dd><dt>Result</dt><dd>{story.result}</dd><dt>What it taught you</dt><dd>{story.lesson}</dd></dl><p className={styles.prepare}><strong>Prepare this detail:</strong> {story.prepare}</p></article>)}</div>
          </section>

          <section id="hard-questions" className={styles.section}>
            <SectionHeading number="07" eyebrow="Confidence with an accurate boundary" title="Answer the concern that is actually being raised." />
            <p>Let them finish. If a concern is fair, acknowledge it without treating it as a verdict. Give the most relevant evidence, then explain what you would do about the remaining gap.</p>
            <div className={styles.objections}>{objections.map((item) => <article key={item.title}><h3>“{item.title}”</h3><blockquote>{item.answer}</blockquote><p className={styles.proofNote}>{item.follow}</p></article>)}</div>
            <div className={styles.note}><h3>“Why you over someone with more studio experience?”</h3><p>“An experienced studio director would bring depth I respect. My case is the combination of internal workflow knowledge, hands-on AI building and team enablement. I can show how I turn a problem into a working process, how I critique the output, and how I make that process easier for someone else to use. I’d want you to assess that combination against the work this studio needs to deliver.”</p></div>
            <div className={styles.note}><h3>“Is your personal prototype ready for the Agency?”</h3><p>“The public studio demonstrates a capability and makes the workflow visible. It is not an enterprise deployment. I’d start with a bounded pilot, approved tools and inputs, an agreed quality bar, and a named review owner. My internal platform experience helps me understand the difference between something that runs and something the business can rely on.”</p></div>
          </section>

          <section id="delivery" className={styles.section}>
            <SectionHeading number="08" eyebrow="Emotional intelligence as behavior" title="Make the interview feel like working with you." />
            <div className={styles.deliveryGrid}>
              <article><h3>Listen for the real concern</h3><p>Someone asking about AI quality may be protecting craft, a deadline or the brand. Ask, “Where does it tend to fall short for your team?” before explaining the technology.</p><p>Acknowledge what you heard: “So the difficult part is keeping the product consistent across variants.” Then answer that problem.</p></article>
              <article><h3>Make room for their expertise</h3><p>Say, “I’d want your view on the review standard here.” Be specific about what you would own and where you would seek specialist judgment.</p><p>Respect does not mean avoiding decisions. Explain how you would reach a decision and who is accountable for it.</p></article>
              <article><h3>Use a point, an example and a pause</h3><p>Land the answer in the first sentence. Spend most of the time on one example. End with its relevance to this role and pause.</p><p>If you notice you are wandering: “The key point is…” Finish that sentence. You do not need to rescue every detail you started.</p></article>
              <article><h3>Handle uncertainty openly</h3><p>“I haven’t handled that exact situation yet. The closest example is…” distinguishes experience from your proposed approach.</p><p>If you do not know a tool detail, explain what you would check and how you would protect the deadline. Avoid improvising a technical fact.</p></article>
              <article><h3>Respond to interruption warmly</h3><p>Stop the walkthrough when they ask a question. Answer before returning to the route. “That connects to the handoff decision” is a useful bridge, if it really does.</p><p>The presentation is serving the conversation. Finishing every page is not the goal.</p></article>
              <article><h3>Show pride without dismissing craft</h3><p>Be pleased with what you built. Describe where your judgment improved it and where experienced production skills are still needed.</p><p>Avoid “anyone can do this now,” “tenure doesn’t matter,” or claims that other teams are behind. Talk about work you could help them do.</p></article>
            </div>
            <h3 className={styles.subheading}>Connect to CORE through an example.</h3>
            <div className={styles.values}><p><strong>Care</strong>Giving people time back and reducing avoidable confusion.</p><p><strong>Ownership</strong>Following a piece through review, sound and handoff.</p><p><strong>Respect</strong>Learning from existing craft and changing your mind when the evidence calls for it.</p><p><strong>Excellence</strong>Noticing when an output fails the brief and making a specific correction.</p></div>
            <p>These are ways your examples can connect to the values named in the JD. Pick a real incident for each value you discuss; repeating the words alone adds little.</p>
            <div className={styles.note}><h3>A calm close</h3><p>“This conversation has helped me understand where the studio needs to prove itself. The combination I’d bring is production workflow experience, hands-on AI making and team enablement. I’m excited by the chance to take that further here, and I’d be happy to work through a brief if more evidence of my approach would be useful.”</p><p className={styles.proofNote}>Afterwards, send a short thank-you that reflects one specific point they raised. Share only the most relevant case link or follow-up evidence.</p></div>
          </section>

          <section id="first-90-days" className={styles.section}>
            <SectionHeading number="09" eyebrow="A proposal to discuss, not a promise" title="Start small enough to learn what is dependable." />
            <p>Offer this if they ask how you would begin. Say you would shape it with the Head of Production and the team after understanding current demand, constraints and existing experiments.</p>
            <div className={styles.phases}>{phases.map((phase) => <article key={phase.period}><p className={styles.eyebrow}>{phase.period}</p><h3>{phase.title}</h3><ul>{phase.actions.map((action) => <li key={action}>{action}</li>)}</ul><p className={styles.prepare}><strong>What you would bring back:</strong> {phase.deliverable}</p></article>)}</div>
            <div className={styles.note}><h3>Measure the approved asset, not just the generation.</h3><p>For comparable briefs, capture elapsed time from accepted intake to approval, human effort including finishing and review, first-pass acceptance and rework, and total cost including retries. Track whether a second person can repeat the workflow and which tasks still need expert help.</p><p>Count in-house volume only against agreed quality and approval standards. Keep a fallback route when the AI process is inconsistent. Targets should follow the baseline and the business need.</p></div>
            <div className={styles.experiment}><p className={styles.eyebrow}>A useful pilot test</p><h3>Can a second person deliver the same type of brief?</h3><p>Make one together, then have another operator repeat the process with an appropriate new brief. Observe where they need help, what gets lost at the handoff and how much finishing remains. That is a more informative scale test than another impressive result produced by the builder alone.</p></div>
          </section>

          <section id="ask-them" className={styles.section}>
            <SectionHeading number="10" eyebrow="Choose two or three" title="Questions that create a useful conversation." />
            <p>Ask because you want to learn the answer. Leave space for it and use what you hear. You do not need to insert a question after every slide or turn the interview into a workshop.</p>
            <div className={styles.audienceQuestions}>{audienceQuestions.map((item) => <article key={item.ask}><p className={styles.eyebrow}>{item.when}</p><h3>“{item.ask}”</h3><p>{item.purpose}</p></article>)}</div>
          </section>

          <section id="credibility" className={styles.section}>
            <SectionHeading number="11" eyebrow="A final check before you say it" title="Keep the story confident and verifiable." />
            <ul className={styles.credibilityList}>
              <li><strong>Experience dates.</strong> The JD asks for ten or more years across creative production, advertising, creative technology or a related field, plus two years of hands-on AI content creation. Prepare your real chronology and dated examples. The supplied documents do not clearly establish both thresholds; explain transferable experience without rounding up years.</li>
              <li><strong>Team size.</strong> Your résumé says eight people with three direct reports. Explain direct and matrix responsibilities accurately.</li>
              <li><strong>Returned capacity.</strong> The workflow covered tasks previously spanning four roles. Describe work and time returned, not four jobs eliminated or savings you have not measured.</li>
              <li><strong>Reported metrics.</strong> Use PersoPot’s “15% to under 2%” only if you can explain the sample, definition of failure, timeframe and method. Otherwise discuss the improvement qualitatively.</li>
              <li><strong>Prototype status.</strong> Use “publicly hosted working prototype” for this studio. Keep the internal platform’s deployment and enterprise review separate. Hosting a site does not demonstrate enterprise readiness.</li>
              <li><strong>Creative authorship.</strong> Explain your concept, reference choices, critique and direction, and the assistance used for code and media. Claim only the modelling, editing and finishing you personally performed.</li>
              <li><strong>Final delivery.</strong> Distinguish the generated MP4, separate voiceover or WAV, browser playback and a mastered delivery file. State which one you are showing.</li>
              <li><strong>Packaging and claims.</strong> VELUNE is a fictional concept. Generated label text, nutrition panels and visual reference angles are not verified product facts or proof of packaging compliance.</li>
              <li><strong>Inventory and adoption.</strong> Avoid stale model counts. A working demo, documented playbook and implemented handoff do not establish team adoption or measured production savings.</li>
            </ul>
            <div className={styles.rewrites}><div><p>Retire</p><h3>“I use AI better than most.”</h3><p>Use</p><blockquote>“Let me show you how I diagnosed the failure and improved the result.”</blockquote></div><div><p>Retire</p><h3>“Adaptability is worth more than tenure.”</h3><p>Use</p><blockquote>“My learning speed and workflow experience would be useful alongside the team’s existing craft.”</blockquote></div><div><p>Retire</p><h3>“I’ll make it faster from day one.”</h3><p>Use</p><blockquote>“I’d start by agreeing a pilot and a baseline, then show where the workflow actually saves effort.”</blockquote></div></div>
          </section>

          <section id="practice" className={styles.section}>
            <SectionHeading number="12" eyebrow="Say it once. Improve one thing. Try again." title="Practise until the structure feels familiar." />
            <p>First, answer without reading the hint. Then check whether you made one clear point, supplied evidence and finished within the time. Rewrite only the part that felt unclear. You are practising a conversation, not a performance of perfect wording.</p>
            <InterviewPractice questions={questions} />
            <div className={styles.nextPass}><h3>Before the next revision of this notebook</h3><p>Add one real teaching story, one example of resolving a disagreement, defensible workflow metrics if available, your exact AI-work timeline, and the interview length and panel roles when you know them. Those details will make the next version more personal and precise.</p></div>
          </section>

          <footer className={styles.sources}><p className={styles.eyebrow}>Basis of this notebook</p><p>Prepared from your supplied AI Content Studio job description, AjwadRauf_Resume.pdf, your own letter to Nan, and the decisions observed during our portfolio build. The letter is your application narrative, not an external recommendation. Scripts and the 90-day plan are coaching drafts; suggested activities are not claims of past achievements.</p><p>General interview references: <a href="https://careerservices.fas.harvard.edu/resources/interviewing/">Harvard Mignone Center for Career Success</a> and <a href="https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/">US Office of Personnel Management</a>. The original attachments and their contact details are not published here.</p><a href="#start">Back to the central story ↑</a></footer>
        </main>
      </div>
    </div>
  );
}
