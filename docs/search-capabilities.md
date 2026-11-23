# Search capability matrix

The floating composer sends typed text and voice transcripts to the same local parser. The parser adds no model call. Inventory and Ask keep their own parsers and existing AI behavior. Unified Search uses Ask only when the request explicitly includes Primary (برايمري or أولي in Arabic), or the user selects Primary or Both. A Primary keyword applies to that request only. The examples below belong with `apps/mobile/src/searchCapabilities.ts` and its regression suite. Update all three when a capability or alias changes.

| Capability | English example | Egyptian Arabic example | Result and scope |
|---|---|---|---|
| Inventory | Villa in Rehab | فيلا في الرحاب | Existing inventory search |
| Primary and Ask | Primary apartments in New Cairo | برايمري شقق في التجمع | Existing project answers and results |
| Both | Resale and primary apartments | شقق ريسيل وبرايمري | Inventory and Primary results, independently |
| Lead lookup | Open lead Sara Hassan | افتح العميل ٠١٠١٢٣٤٥٦٧٨ | Permission-scoped list by name, phone, or code. Pick a record before acting |
| Lead-to-property | Find options for L-0042 | إيه اللي يناسب العميل ده | Saved requirements and matching inventory. Choose the lead by name, phone, or code. Adjust budget, area and bedroom minimum for the current search. The saved request is preserved |
| Property-to-lead | Who might want MIR46? | مين يناسبه MIR46؟ | Visible open leads and matched requirements. Scans up to 50 recent alert-enabled requests and labels partial results |
| Unassigned | Show unassigned leads | عملاء من غير بروكر | Open leads without an assignee in the visible scope |
| Uncontacted | Show leads nobody called | مين لسه محدش كلمهم؟ | New leads without a contact timestamp |
| Late first response | Show late first responses | مين ميعاد أول رد عدّى؟ | New leads with a current elapsed response deadline. Historical breaches after reassignment are outside this report |
| Follow-ups | Who do I need to call today? | أكلم مين النهارده؟ | Open follow-ups due today with the existing lead actions |
| No next step | Show leads with no next step | عملاء من غير خطوة جايه | Open leads without a scheduled follow-up |
| Tomorrow viewings | What viewings do I have tomorrow? | معاينات بكرة | Open lead follow-ups with viewing kind in tomorrow's Cairo calendar day. Separate Calendar appointments remain in Calendar |
| Overdue follow-ups | Show overdue follow-ups | متابعات متأخرة | Open follow-ups past their due time |
| Latest assignment | Leads assigned last month | العملاء اللي اتسلموا الشهر اللي فات | Latest assignment timestamp in the previous Cairo calendar month |
| Assignee filter | Show leads assigned to Sara Hassan · Only Sara’s | العملاء اللي مع سارة حسن · بس بتوع سارة | Filter by a visible broker, directly or in the active lead view. Ask the user to choose when the name is ambiguous |
| Create lead | Add lead Ahmed 01012345678 | ضيف عميل أحمد ٠١٠١٢٣٤٥٦٧٨ | Existing editable form. Confirm Save there |
| Stage and note | Move Sara to viewing; note: Saturday agreed | انقل سارة إلى معاينة؛ ملاحظة: اتفقنا على السبت | Pick a lead by name or phone, or specify a lead code. Versioned preview and confirmation |
| Client history | What did we last promise Sara? | آخر حاجة وعدنا بيها سارة | Find the lead and open the original timeline. No inferred promise summary |
| Unit review | Which units need confirmation? | الوحدات اللي محتاجة مراجعة | Existing units-to-confirm filter |
| Missing photos | Which units are missing photos? | وحدات من غير صور | Existing unit list with the missing-photo filter |
| Unit to lead | Send unit to a lead | ابعت الوحدة لعميل | Choose and review a lead from an active unit, then open WhatsApp with the existing lead-linked message. |
| Unit detail | Open MIR46 | افتح MIR46 | Existing unit detail and authorized actions |
| Agency dashboard | Show dashboard | لوحة الشركة | Manager dashboard and source, broker and period controls |
| Rankings | Top achiever | مين أكتر واحد قفل؟ | Manager rankings with deals, commission and median first response choices. Shows the actual rolling date selector |
| Team workload | Who has the most overdue follow-ups? | مين عنده متابعات متأخرة؟ | Existing authorized Team view. Exact ranking and capacity calculation are pending |
| Sources | Lead sources | مصادر العملاء | Existing sources report. Signed-deal attribution questions explain their current limitation |
| Win/loss | Why did we lose deals? | ليه خسرنا الصفقات؟ | Existing win/loss report with its visible period filters |
| Deal follow-through | What's holding up this deal? | الصفقة واقفة ليه؟ | Existing Deals screen. An individual diagnosis needs a resolved deal and supporting events |
| Link opens | Who opened my links? | مين فتح اللينكات؟ | Existing opened-links filter. It cannot infer whether the client replied |
| Sent offers | Find the offer I sent Sara last week | هات العرض اللي بعته لسارة الأسبوع اللي فات | Pick the lead, then list your links tied to that lead. The seven-day window is rolling. Cross-channel history and prices at send time remain pending |
| Changes | What changed while I was away? | إيه اللي حصل وأنا غايب؟ | Existing activity log where permitted. A dated cross-record summary is pending |
| Compare | Compare these three units | قارن الوحدات دي | Existing comparison workflow. Automatic lead requirements overlay and selection by free-form references are pending |
| Settings | Open settings | افتح الإعدادات | Existing settings. Language and theme changes still happen through their own controls |
| Notifications | Open notifications | افتح الإشعارات | Existing notification inbox |
| Saved searches | Show saved searches | افتح البحث المحفوظ | Existing saved searches |

Unsupported or ambiguous reports keep the original question and offer an applicable route or clarification. Ordinary unclassified property text continues into unit search. Access checks, scope, and confirmation remain with the owning services.

The trash icon beside the floating composer clears chat for its current result, composer, filters, and local recent searches. It does not delete leads or saved searches. The ring around the composer action button shows the signed-in person’s remaining personal allowance, or a full allowance ring when there is no personal cap (usage details are in the menu). Owners and managers also see an agency segment. Exact balances are in More → My usage and limits. Lead rows open the lead, where Matching units is available. Explicit property matching requests open the matches directly.

## Search home

Search opens first for all mobile roles and is the filled centre button in the bottom bar, including for Data Entry. The idle screen shows a named Cairo-time greeting and one priority list. Broker reminders are personal, team lead reminders use their team's scope, and owner and manager reminders cover the agency. The evening brief uses recorded activity and shows upcoming viewings when relevant. Data Entry sees the full overdue count and the oldest three visible units, with a paginated queue behind View all. The brief uses existing records and makes no AI calls. The existing Today metrics, tasks, leases, inventory actions, and role-specific cards appear directly below the priority brief in Search. The mobile app has no standalone Today route. Unit review starts collapsed. Owners and managers can turn off agency-wide overdue unit reminders in Notifications and save. Overdue units remain in the review list.

## Animated practice

**Try Search** appears on the first visit per account and role on the device. It can be replayed from **Search tools**. The practice uses bundled demo data, the normal text composer, and a guided result for each role. It makes no search, transcription, or CRM mutation requests. Voice and open-ended commands can be tried after exiting practice. The supported practice language is the app language.

| Role | English example | Egyptian Arabic example | Expected practice outcome |
|---|---|---|---|
| Broker | Find options for Sara Hassan | هات وحدات مناسبة لسارة حسن | Choose the phone ending in 4321. View a two-bedroom apartment requirement and DEMO-01. |
| Team lead | Show overdue follow-ups | متابعات متأخرة | Pick Sara and see L-0101 and L-0102, or Omar and see L-0103. |
| Manager | Show unassigned leads | عملاء من غير بروكر | Assign L-0104 to Sara. The practice count changes from one to zero. |
| Owner | How many deals did we close? | كام صفقة قفلنا؟ | Tap any bar to reveal the associated demo records. The three bars have three, two and four records. |
| Data Entry | Which units need confirmation? | الوحدات اللي محتاجة مراجعة | Confirm DEMO-03. The count changes from four to three, and DEMO-04 enters the preview. |

Each session restarts from the same data. The live cross-role QA seed and full Help guide are separate deliverables.
