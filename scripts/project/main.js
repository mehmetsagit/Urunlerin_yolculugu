const openedConceptCards = new Set();

const journeyOverviews = {
	oyun2: { cardObject: "nesne_oyun2", activityLayout: "oyun2_1" },
	oyun3: { cardObject: "nesne_oyun3", activityLayout: "oyun3_1" },
	oyun4: { cardObject: "nesne_oyun4", activityLayout: "oyun4_1" }
};

const journeyActivities = {
	oyun2_1: {
		cardObject: "nesne_oyun2",
		overviewLayout: "oyun2",
		nextLayout: "oyun3",
		hintObject: "ipucu_2"
	},
	oyun3_1: {
		cardObject: "nesne_oyun3",
		overviewLayout: "oyun3",
		nextLayout: "oyun4",
		hintObject: "ipucu_3"
	},
	oyun4_1: {
		cardObject: "nesne_oyun4",
		overviewLayout: "oyun4",
		nextLayout: "oyun5",
		hintObject: "ipucu_4"
	}
};

const classificationCardFrames = [0, 1, 2, 3, 4, 5];
const classificationAnswerByFrame = [0, 0, 1, 1, 2, 2];
const multipleChoiceAnswerFrames = [0, 1, 2];
const multipleChoiceCorrectFrame = 1;
const hoverButtonObjectNames = [
	"btn_3nokta",
	"btn_ev",
	"btn_ses",
	"btn_bilgi",
	"btn_butonlar",
	"btn_ekran",
	"btn_etk_basla",
	"btn_basla",
	"btn_ileri",
	"btn_yeniden_oyna",
	"btn_kontrolet",
	"btn_incele",
	"btn_gerial",
	"btn_kapat"
];
const cursorObjectNames = [
	"nesne_oyun1",
	"nesne_oyun2",
	"nesne_oyun3",
	"nesne_oyun4",
	"nesne_oyun5",
	"oyun6_cevaplar",
	"oyun6_abc"
];

let journeyState = null;
let classificationState = null;
let multipleChoiceState = null;
let lastClassificationSequence = null;
let lastMultipleChoiceSequence = null;
let utilityMenuState = null;
let hoverButtonEntries = new Map();
let hoveredButtonEntry = null;
let isAudioMuted = false;
let confettiParticles = [];
let orientationWarningElement = null;
let useExpandedTouchTargets = false;
const hoverGlowInstances = new WeakSet();
const confettiInstances = new WeakSet();

runOnStartup(async runtime =>
{
	runtime.addEventListener("beforeprojectstart", () => onBeforeProjectStart(runtime));
});

function onBeforeProjectStart(runtime)
{
	initializeMobileSupport(runtime);

	runtime.addEventListener("afteranylayoutstart", event =>
	{
		initializeLayout(runtime, event.layout.name);
	});

	// Pointer events cover mouse, pen and touch input with the same handlers.
	runtime.addEventListener("pointerdown", event => onPointerDown(runtime, event));
	runtime.addEventListener("pointermove", event => onPointerMove(runtime, event));
	runtime.addEventListener("pointerup", event => onPointerUp(runtime, event));
	runtime.addEventListener("tick", () => updateGlobalInterface(runtime));
	runtime.addEventListener("resize", event =>
		updateOrientationWarning(event.cssWidth, event.cssHeight));
}

function initializeLayout(runtime, layoutName)
{
	journeyState = null;
	classificationState = null;
	multipleChoiceState = null;
	initializeGlobalInterface(runtime);

	if (layoutName === "oyun1")
	{
		initializeConceptCards(runtime);
		return;
	}

	const overviewConfig = journeyOverviews[layoutName];
	if (overviewConfig)
	{
		prepareJourneyCards(runtime, overviewConfig.cardObject);
		return;
	}

	const activityConfig = journeyActivities[layoutName];
	if (activityConfig)
	{
		initializeJourneyActivity(runtime, activityConfig);
		return;
	}

	if (layoutName === "oyun5")
	{
		initializeClassification(runtime);
		return;
	}

	if (layoutName === "oyun6")
		initializeMultipleChoice(runtime);
}

function initializeConceptCards(runtime)
{
	openedConceptCards.clear();

	const cards = getInstances(runtime, "nesne_oyun1").sort((a, b) => a.x - b.x);
	const closedFrames = [0, 2, 4];
	for (let index = 0; index < cards.length; index++)
	{
		cards[index].animationFrame = closedFrames[index] ?? 0;
		cards[index].isVisible = true;
	}

	for (const highlight of getInstances(runtime, "yesil"))
		highlight.isVisible = false;

	setObjectVisibility(runtime, "btn_ileri", false);
}

function prepareJourneyCards(runtime, objectName)
{
	const allCards = getInstances(runtime, objectName).sort((a, b) => a.x - b.x);
	const groups = [];

	for (const card of allCards)
	{
		let group = groups.find(candidate =>
			Math.abs(candidate[0].x - card.x) < 25 &&
			Math.abs(candidate[0].y - card.y) < 25);

		if (!group)
		{
			group = [];
			groups.push(group);
		}

		group.push(card);
	}

	const cards = [];
	for (const group of groups.sort((a, b) => a[0].x - b[0].x))
	{
		const visibleCard = group.reduce((top, card) => card.zIndex > top.zIndex ? card : top);
		for (const card of group)
			card.isVisible = card === visibleCard;

		cards.push(visibleCard);
	}

	while (cards.length > 5)
	{
		const extraCard = cards.pop();
		extraCard.isVisible = false;
	}

	cards.sort((a, b) => a.x - b.x);
	for (let index = 0; index < cards.length; index++)
	{
		cards[index].animationFrame = index;
		cards[index].isVisible = true;
	}

	return cards;
}

function initializeJourneyActivity(runtime, config)
{
	const cards = prepareJourneyCards(runtime, config.cardObject);
	const placeholders = getInstances(runtime, "nesne_oyun_bos").sort((a, b) => a.x - b.x);
	const topSlots = cards.map(card => ({ x: card.x, y: card.y }));
	const shuffledFrames = shuffledIndices(cards.length);
	const originalPositions = new Map();

	for (let slotIndex = 0; slotIndex < shuffledFrames.length; slotIndex++)
	{
		const card = cards.find(candidate => candidate.animationFrame === shuffledFrames[slotIndex]);
		const slot = topSlots[slotIndex];
		card.setPosition(slot.x, slot.y);
		card.moveToTop();
		originalPositions.set(card.uid, { x: slot.x, y: slot.y });
	}

	for (let index = 0; index < placeholders.length; index++)
	{
		placeholders[index].animationFrame = index;
		placeholders[index].isVisible = true;
	}

	const hint = getFirstInstance(runtime, config.hintObject);
	if (hint)
		hint.isVisible = false;

	const checkButton = getFirstInstance(runtime, "btn_kontrolet");
	const undoButton = getFirstInstance(runtime, "btn_gerial");
	const inspectButton = getFirstInstance(runtime, "btn_incele");

	if (checkButton)
		checkButton.isVisible = false;
	if (undoButton)
		undoButton.isVisible = false;
	if (inspectButton)
		inspectButton.isVisible = false;

	setObjectVisibility(runtime, "btn_ileri", false);

	journeyState = {
		config,
		cards,
		placeholders,
		originalPositions,
		selected: [],
		wrongAttempts: 0,
		hint,
		hintVisible: false,
		closeButton: null,
		pendingReset: false,
		completed: false,
		nextButton: null
	};
}

function initializeClassification(runtime)
{
	const dropAreas = getInstances(runtime, "fake_oyun5").sort((a, b) => a.x - b.x);
	for (const hitArea of dropAreas)
		hitArea.isVisible = false;

	const firstCard = getFirstInstance(runtime, "nesne_oyun5");
	const categories = getInstances(runtime, "nesne2_oyun5").sort((a, b) => a.x - b.x);
	const hint = getFirstInstance(runtime, "ipucu_5");
	const cardSequence = createClassificationSequence();

	firstCard.animationFrame = cardSequence[0];
	firstCard.setPosition(960, 618);
	firstCard.setSize(495, 649);
	firstCard.isVisible = true;
	firstCard.moveToTop();
	resetCategoryAppearance(categories);

	if (hint)
		hint.isVisible = false;

	setObjectVisibility(runtime, "btn_ileri", false);
	setObjectVisibility(runtime, "btn_kontrolet", false);

	classificationState = {
		categories,
		dropAreas,
		cardSequence,
		hint,
		index: 0,
		currentCard: firstCard,
		placedCards: [],
		bigCardPosition: { x: 960, y: 618 },
		bigCardSize: { width: 495, height: 649 },
		wrongAttempts: 0,
		hintVisible: false,
		closeButton: null,
		dragging: null,
		completed: false
	};
}

function initializeMultipleChoice(runtime)
{
	const answers = getInstances(runtime, "oyun6_cevaplar").sort((a, b) => a.y - b.y);
	const letters = getInstances(runtime, "oyun6_abc").sort((a, b) => a.y - b.y);
	const explanation = getFirstInstance(runtime, "oyun6_aciklama");
	const hint = getFirstInstance(runtime, "ipucu_6");
	const answerSequence = createMultipleChoiceSequence();

	for (let index = 0; index < answers.length; index++)
	{
		const answer = answers[index];
		answer.animationFrame = answerSequence[index];
		answer.opacity = 1;
	}
	for (const letter of letters)
		letter.opacity = 1;

	if (explanation)
		explanation.isVisible = false;
	if (hint)
		hint.isVisible = false;

	setObjectVisibility(runtime, "btn_ileri", false);

	multipleChoiceState = {
		answers,
		letters,
		explanation,
		hint,
		wrongAttempts: 0,
		hintVisible: false,
		closeButton: null,
		resolved: false
	};
}

function onPointerDown(runtime, event)
{
	if (event.button !== undefined && event.button !== 0)
		return;
	if (runtime.layout.name !== "oyun5" || !classificationState)
		return;

	const layer = runtime.layout.getLayer(0);
	const [x, y] = layer.cssPxToLayer(event.clientX, event.clientY);
	startClassificationDrag(classificationState, x, y);
}

function onPointerMove(runtime, event)
{
	const layer = runtime.layout.getLayer(0);
	const [x, y] = layer.cssPxToLayer(event.clientX, event.clientY);
	updateHoveredButton(runtime, x, y, event.pointerType);

	if (runtime.layout.name !== "oyun5" || !classificationState?.dragging)
		return;

	const drag = classificationState.dragging;
	drag.instance.setPosition(x + drag.offsetX, y + drag.offsetY);
	drag.instance.moveToTop();
}

function onPointerUp(runtime, event)
{
	if (event.button !== undefined && event.button !== 0)
		return;

	const layoutName = runtime.layout.name;
	const layer = runtime.layout.getLayer(0);
	const [x, y] = layer.cssPxToLayer(event.clientX, event.clientY);

	if (layoutName === "oyun5" && classificationState?.dragging)
	{
		finishClassificationDrag(runtime, classificationState, x, y);
		return;
	}

	if (handleGlobalInterfaceClick(runtime, x, y))
		return;

	if (layoutName === "giris")
	{
		if (isObjectHit(runtime, "btn_bilgi", x, y))
			runtime.goToLayout("bilgi");
		else if (isObjectHit(runtime, "btn_etk_basla", x, y))
			runtime.goToLayout("giris1");
		return;
	}

	if (layoutName === "bilgi")
	{
		if (isObjectHit(runtime, "btn_butonlar", x, y))
			runtime.goToLayout("butonlar");
		else if (isObjectHit(runtime, "btn_kapat", x, y))
			runtime.goToLayout("giris");
		return;
	}

	if (layoutName === "butonlar")
	{
		if (isObjectHit(runtime, "btn_bilgi", x, y))
			runtime.goToLayout("bilgi");
		else if (isObjectHit(runtime, "btn_kapat", x, y))
			runtime.goToLayout("giris");
		return;
	}

	if (layoutName === "giris1")
	{
		if (isObjectHit(runtime, "btn_basla", x, y))
			runtime.goToLayout("oyun1");
		else
			goHomeIfRequested(runtime, x, y);
		return;
	}

	if (layoutName === "oyun1")
	{
		if (handleConceptCard(runtime, x, y))
			return;

		if (isObjectHit(runtime, "btn_ileri", x, y))
			runtime.goToLayout("oyun1_1");
		else
			goHomeIfRequested(runtime, x, y);
		return;
	}

	if (layoutName === "oyun1_1")
	{
		if (isObjectHit(runtime, "btn_ileri", x, y))
			runtime.goToLayout("oyun2");
		else
			goHomeIfRequested(runtime, x, y);
		return;
	}

	const overviewConfig = journeyOverviews[layoutName];
	if (overviewConfig)
	{
		if (isObjectHit(runtime, "btn_ileri", x, y))
			runtime.goToLayout(overviewConfig.activityLayout);
		else
			goHomeIfRequested(runtime, x, y);
		return;
	}

	if (journeyActivities[layoutName])
	{
		if (!handleJourneyActivity(runtime, x, y))
			goHomeIfRequested(runtime, x, y);
		return;
	}

	if (layoutName === "oyun5")
	{
		if (!handleClassification(runtime, x, y))
			goHomeIfRequested(runtime, x, y);
		return;
	}

	if (layoutName === "oyun6")
	{
		if (!handleMultipleChoice(runtime, x, y))
			goHomeIfRequested(runtime, x, y);
		return;
	}

	if (layoutName === "oyun7")
	{
		if (isObjectHit(runtime, "btn_yeniden_oyna", x, y))
			runtime.goToLayout("giris");
		else
			goHomeIfRequested(runtime, x, y);
	}
}

function handleConceptCard(runtime, x, y)
{
	const cards = getInstances(runtime, "nesne_oyun1");
	const highlights = getInstances(runtime, "yesil");

	for (let index = cards.length - 1; index >= 0; index--)
	{
		const card = cards[index];
		if (!isInstanceHit(card, x, y))
			continue;

		if (!openedConceptCards.has(card.uid))
		{
			if (card.animationFrame % 2 === 0)
				card.animationFrame += 1;

			openedConceptCards.add(card.uid);
			const matchingHighlight = findNearestInstance(card, highlights);
			if (matchingHighlight)
				matchingHighlight.isVisible = true;
		}

		if (openedConceptCards.size === cards.length)
			setObjectVisibility(runtime, "btn_ileri", true);

		return true;
	}

	return false;
}

function handleJourneyActivity(runtime, x, y)
{
	const state = journeyState;
	if (!state)
		return false;

	if (state.hintVisible)
	{
		if (isObjectHit(runtime, "btn_incele", x, y))
		{
			runtime.goToLayout(state.config.overviewLayout);
			return true;
		}

		hideJourneyHintAndReset(runtime, state);
		return true;
	}

	if (state.completed)
	{
		if (state.nextButton && isInstanceHit(state.nextButton, x, y))
			runtime.goToLayout(state.config.nextLayout);
		return true;
	}

	if (isObjectHit(runtime, "btn_incele", x, y))
	{
		runtime.goToLayout(state.config.overviewLayout);
		return true;
	}

	if (isObjectHit(runtime, "btn_gerial", x, y))
	{
		undoJourneySelection(runtime, state);
		return true;
	}

	if (isObjectHit(runtime, "btn_kontrolet", x, y))
	{
		checkJourneyOrder(runtime, state);
		return true;
	}

	for (let index = state.cards.length - 1; index >= 0; index--)
	{
		const card = state.cards[index];
		if (state.selected.includes(card) || !isInstanceHit(card, x, y))
			continue;

		const target = state.placeholders[state.selected.length];
		card.setPosition(target.x, target.y);
		card.moveToTop();
		state.selected.push(card);
		updateJourneyControls(runtime, state);
		return true;
	}

	return false;
}

function undoJourneySelection(runtime, state)
{
	const card = state.selected.pop();
	if (!card)
		return;

	const originalPosition = state.originalPositions.get(card.uid);
	card.setPosition(originalPosition.x, originalPosition.y);
	card.moveToTop();
	updateJourneyControls(runtime, state);
}

function updateJourneyControls(runtime, state)
{
	const hasSelection = state.selected.length > 0;
	const isFull = state.selected.length === state.cards.length;
	setObjectVisibility(runtime, "btn_kontrolet", isFull);
	setObjectVisibility(runtime, "btn_gerial", hasSelection && !isFull);

	if (isFull)
	{
		const checkButton = getFirstInstance(runtime, "btn_kontrolet");
		const undoButton = getFirstInstance(runtime, "btn_gerial");
		if (checkButton && undoButton)
			checkButton.setPosition(checkButton.x, undoButton.y);
	}
}

function checkJourneyOrder(runtime, state)
{
	if (state.selected.length !== state.cards.length)
		return;

	const isCorrect = state.selected.every((card, index) => card.animationFrame === index);
	if (isCorrect)
	{
		completeJourney(runtime, state);
		return;
	}

	state.wrongAttempts += 1;
	state.pendingReset = true;
	showHint(runtime, state, 500);
	setObjectVisibility(runtime, "btn_kontrolet", false);
}

function hideJourneyHintAndReset(runtime, state)
{
	hideHint(runtime, state);

	if (state.pendingReset)
	{
		resetJourneySelection(state);
		state.pendingReset = false;
	}

	updateJourneyControls(runtime, state);
}

function resetJourneySelection(state)
{
	for (const card of state.selected)
	{
		const position = state.originalPositions.get(card.uid);
		card.setPosition(position.x, position.y);
		card.moveToTop();
	}

	state.selected.length = 0;
}

function completeJourney(runtime, state)
{
	state.completed = true;
	setObjectVisibility(runtime, "btn_kontrolet", false);
	setObjectVisibility(runtime, "btn_gerial", false);
	setObjectVisibility(runtime, "btn_incele", false);

	state.nextButton = runtime.objects.btn_ileri.createInstance(0, 1796, 1022);
	state.nextButton.isVisible = true;
	state.nextButton.moveToTop();

	burstConfetti(runtime);
}

function handleClassification(runtime, x, y)
{
	const state = classificationState;
	if (!state)
		return false;

	if (state.hintVisible)
	{
		hideHint(runtime, state);
		resetPlacedCardAppearance(state);
		return true;
	}

	if (state.completed)
	{
		if (isObjectHit(runtime, "btn_ileri", x, y))
			runtime.goToLayout("oyun6");
		return true;
	}

	if (!isObjectHit(runtime, "btn_kontrolet", x, y))
		return false;

	if (state.currentCard || state.placedCards.length !== state.cardSequence.length)
		return true;

	const isCorrect = state.placedCards.every(card =>
		card.categoryIndex === classificationAnswerByFrame[card.cardFrame]);

	if (isCorrect)
	{
		completeClassification(runtime, state);
		return true;
	}

	state.wrongAttempts += 1;
	showHint(runtime, state, 520);
	return true;
}

function startClassificationDrag(state, x, y)
{
	if (state.hintVisible || state.completed || state.dragging)
		return false;

	let instance = null;
	let placedCard = null;
	let isCurrentCard = false;

	if (state.currentCard && isInstanceHit(state.currentCard, x, y))
	{
		instance = state.currentCard;
		isCurrentCard = true;
	}
	else if (!state.currentCard)
	{
		for (let index = state.placedCards.length - 1; index >= 0; index--)
		{
			const candidate = state.placedCards[index];
			if (!isInstanceHit(candidate.instance, x, y))
				continue;

			instance = candidate.instance;
			placedCard = candidate;
			break;
		}
	}

	if (!instance)
		return false;

	if (isCurrentCard)
	{
		const dragHeight = 255;
		const dragWidth = dragHeight * state.bigCardSize.width / state.bigCardSize.height;
		instance.setSize(dragWidth, dragHeight);
	}
	else
	{
		showSelectedPlacedCard(state, placedCard);
	}

	instance.moveToTop();
	state.dragging = {
		instance,
		placedCard,
		isCurrentCard,
		originalCategory: placedCard?.categoryIndex ?? null,
		offsetX: instance.x - x,
		offsetY: instance.y - y
	};

	return true;
}

function finishClassificationDrag(runtime, state, x, y)
{
	const drag = state.dragging;
	if (!drag)
		return;

	state.dragging = null;
	const categoryIndex = getClassificationDropCategory(state, x, y);

	if (categoryIndex !== -1)
	{
		if (drag.isCurrentCard)
			placeCurrentClassificationCard(runtime, state, categoryIndex);
		else
			movePlacedClassificationCard(state, drag.placedCard, categoryIndex);
		return;
	}

	if (drag.isCurrentCard)
	{
		drag.instance.setSize(state.bigCardSize.width, state.bigCardSize.height);
		drag.instance.setPosition(state.bigCardPosition.x, state.bigCardPosition.y);
		drag.instance.moveToTop();
	}
	else
	{
		resetPlacedCardAppearance(state);
		reflowClassificationColumn(state, drag.originalCategory);
	}
}

function getClassificationDropCategory(state, x, y)
{
	for (let index = 0; index < state.dropAreas.length; index++)
	{
		if (state.dropAreas[index].containsPoint(x, y))
			return index;
	}

	return -1;
}

function placeCurrentClassificationCard(runtime, state, categoryIndex)
{
	const placedCard = {
		instance: state.currentCard,
		sequenceIndex: state.index,
		cardFrame: state.currentCard.animationFrame,
		categoryIndex
	};

	state.placedCards.push(placedCard);
	state.currentCard = null;
	reflowClassificationColumn(state, categoryIndex);

	state.index += 1;
	if (state.index >= state.cardSequence.length)
	{
		setObjectVisibility(runtime, "btn_kontrolet", true);
		return;
	}

	const nextCard = runtime.objects.nesne_oyun5.createInstance(
		0,
		state.bigCardPosition.x,
		state.bigCardPosition.y
	);
	nextCard.animationFrame = state.cardSequence[state.index];
	nextCard.setSize(state.bigCardSize.width, state.bigCardSize.height);
	nextCard.isVisible = true;
	nextCard.moveToTop();
	state.currentCard = nextCard;
}

function movePlacedClassificationCard(state, placedCard, categoryIndex)
{
	const previousCategory = placedCard.categoryIndex;
	placedCard.categoryIndex = categoryIndex;
	resetPlacedCardAppearance(state);
	reflowClassificationColumn(state, previousCategory);

	if (categoryIndex !== previousCategory)
		reflowClassificationColumn(state, categoryIndex);
}

function reflowClassificationColumn(state, categoryIndex)
{
	const cards = state.placedCards
		.filter(card => card.categoryIndex === categoryIndex)
		.sort((a, b) => a.sequenceIndex - b.sequenceIndex);

	if (!cards.length)
		return;

	const top = 340;
	const bottom = 930;
	const gap = 12;
	const availableHeight = bottom - top;
	const cardHeight = Math.min(255, (availableHeight - gap * (cards.length - 1)) / cards.length);
	const cardWidth = cardHeight * state.bigCardSize.width / state.bigCardSize.height;
	const x = state.categories[categoryIndex].x;

	for (let index = 0; index < cards.length; index++)
	{
		const card = cards[index].instance;
		const y = top + cardHeight / 2 + index * (cardHeight + gap);
		card.setSize(cardWidth, cardHeight);
		card.setPosition(x, y);
		card.moveToTop();
	}
}

function completeClassification(runtime, state)
{
	state.completed = true;
	resetPlacedCardAppearance(state);
	setObjectVisibility(runtime, "btn_kontrolet", false);
	setObjectVisibility(runtime, "btn_ileri", true);

	burstConfetti(runtime);
}

function resetPlacedCardAppearance(state)
{
	for (const placedCard of state.placedCards)
		placedCard.instance.opacity = 1;
}

function showSelectedPlacedCard(state, selectedCard)
{
	for (const placedCard of state.placedCards)
		placedCard.instance.opacity = placedCard === selectedCard ? 1 : 0.4;
}

function handleMultipleChoice(runtime, x, y)
{
	const state = multipleChoiceState;
	if (!state)
		return false;

	if (state.hintVisible)
	{
		hideHint(runtime, state);
		resetMultipleChoiceAppearance(state);
		return true;
	}

	if (state.resolved)
	{
		if (isObjectHit(runtime, "btn_ileri", x, y))
			runtime.goToLayout("oyun7");
		return true;
	}

	for (let index = 0; index < state.answers.length; index++)
	{
		if (isInstanceHit(state.answers[index], x, y) || isInstanceHit(state.letters[index], x, y))
		{
			evaluateMultipleChoice(runtime, state, index);
			return true;
		}
	}

	return false;
}

function evaluateMultipleChoice(runtime, state, selectedIndex)
{
	showSelectedAnswer(state, selectedIndex);

	if (state.answers[selectedIndex].animationFrame === multipleChoiceCorrectFrame)
	{
		resolveMultipleChoice(runtime, state);
		return;
	}

	state.wrongAttempts += 1;
	showHint(runtime, state, 260);
}

function resolveMultipleChoice(runtime, state)
{
	state.resolved = true;
	state.explanation.isVisible = true;
	state.explanation.moveToTop();
	setObjectVisibility(runtime, "btn_ileri", true);
	burstConfetti(runtime);
}

function resetMultipleChoiceAppearance(state)
{
	for (const answer of state.answers)
		answer.opacity = 1;
	for (const letter of state.letters)
		letter.opacity = 1;
}

function showSelectedAnswer(state, selectedIndex)
{
	for (let index = 0; index < state.answers.length; index++)
	{
		const opacity = index === selectedIndex ? 1 : 0.35;
		state.answers[index].opacity = opacity;
		state.letters[index].opacity = opacity;
	}
}

function resetCategoryAppearance(categories)
{
	for (const category of categories)
		category.opacity = 1;
}

function showSelectedCategory(categories, selectedIndex)
{
	for (let index = 0; index < categories.length; index++)
		categories[index].opacity = index === selectedIndex ? 1 : 0.4;
}

function showHint(runtime, state, targetY)
{
	state.hintVisible = true;
	state.hint.isVisible = true;
	state.hint.setPosition(state.hint.x, targetY);
	state.hint.moveToTop();

	if (!state.closeButton)
		state.closeButton = runtime.objects.btn_kapat.createInstance(0, 0, 0);

	const closeButtonGap = 12;
	const closeX = state.hint.x + state.hint.width / 2 + state.closeButton.width / 2 + closeButtonGap;
	const closeY = state.hint.y - state.hint.height / 2 + state.closeButton.height / 2;
	state.closeButton.setPosition(closeX, closeY);

	state.closeButton.isVisible = true;
	state.closeButton.moveToTop();
	setObjectVisibility(runtime, "btn_incele", true);
}

function hideHint(runtime, state)
{
	state.hintVisible = false;
	if (state.hint)
		state.hint.isVisible = false;
	if (state.closeButton)
		state.closeButton.isVisible = false;
	setObjectVisibility(runtime, "btn_incele", false);
}

function initializeMobileSupport(runtime)
{
	if (typeof document === "undefined")
		return;

	useExpandedTouchTargets =
		(globalThis.navigator?.maxTouchPoints ?? 0) > 0 ||
		globalThis.matchMedia?.("(pointer: coarse)").matches === true;

	const styleId = "urunlerin-yolculugu-mobile-style";
	if (!document.getElementById(styleId))
	{
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			#urunlerin-yolculugu-orientation-warning {
				position: fixed;
				inset: 0;
				z-index: 2147483647;
				display: none;
				align-items: center;
				justify-content: center;
				box-sizing: border-box;
				padding: 24px;
				background: linear-gradient(145deg, #eef8ff 0%, #fff8e8 100%);
				font-family: Arial, sans-serif;
				text-align: center;
				touch-action: none;
				overscroll-behavior: none;
			}
			.urunlerin-yolculugu-orientation-card {
				width: min(86vw, 430px);
				box-sizing: border-box;
				padding: 30px 24px 26px;
				border: 4px solid #168eea;
				border-radius: 28px;
				background: rgba(255, 255, 255, 0.97);
				box-shadow: 0 18px 50px rgba(19, 91, 151, 0.24);
				color: #16446b;
			}
			.urunlerin-yolculugu-phone-wrap {
				position: relative;
				width: 120px;
				height: 120px;
				margin: 0 auto 18px;
			}
			.urunlerin-yolculugu-phone {
				position: absolute;
				left: 36px;
				top: 18px;
				width: 46px;
				height: 82px;
				box-sizing: border-box;
				border: 7px solid #168eea;
				border-radius: 12px;
				background: #e6f5ff;
				animation: urunlerin-yolculugu-rotate-phone 1.8s ease-in-out infinite;
			}
			.urunlerin-yolculugu-phone::after {
				content: "";
				position: absolute;
				left: 50%;
				bottom: 4px;
				width: 8px;
				height: 8px;
				transform: translateX(-50%);
				border-radius: 50%;
				background: #168eea;
			}
			.urunlerin-yolculugu-rotate-arrow {
				position: absolute;
				right: 4px;
				top: 18px;
				font-size: 54px;
				font-weight: 700;
				line-height: 1;
				color: #ff9c20;
			}
			.urunlerin-yolculugu-orientation-title {
				margin-bottom: 8px;
				font-size: clamp(24px, 7vw, 34px);
				font-weight: 800;
			}
			.urunlerin-yolculugu-orientation-text {
				font-size: clamp(17px, 4.8vw, 22px);
				line-height: 1.4;
				color: #3a6486;
			}
			@keyframes urunlerin-yolculugu-rotate-phone {
				0%, 22% { transform: rotate(0deg); }
				65%, 88% { transform: rotate(90deg); }
				100% { transform: rotate(0deg); }
			}
		`;
		document.head.appendChild(style);
	}

	orientationWarningElement = document.getElementById("urunlerin-yolculugu-orientation-warning");
	if (!orientationWarningElement)
	{
		orientationWarningElement = document.createElement("div");
		orientationWarningElement.id = "urunlerin-yolculugu-orientation-warning";
		orientationWarningElement.setAttribute("role", "status");
		orientationWarningElement.innerHTML = `
			<div class="urunlerin-yolculugu-orientation-card">
				<div class="urunlerin-yolculugu-phone-wrap" aria-hidden="true">
					<div class="urunlerin-yolculugu-phone"></div>
					<div class="urunlerin-yolculugu-rotate-arrow">↻</div>
				</div>
				<div class="urunlerin-yolculugu-orientation-title">Cihazınızı Yatay Çevirin</div>
				<div class="urunlerin-yolculugu-orientation-text">Etkinliğe devam etmek için cihazınızı yan çeviriniz.</div>
			</div>
		`;
		document.body.appendChild(orientationWarningElement);
	}

	updateOrientationWarning();
}

function updateOrientationWarning(cssWidth, cssHeight)
{
	if (!orientationWarningElement)
		return;

	const width = Number.isFinite(cssWidth)
		? cssWidth
		: document.documentElement.clientWidth;
	const height = Number.isFinite(cssHeight)
		? cssHeight
		: document.documentElement.clientHeight;
	const shouldShow = useExpandedTouchTargets && height > width;

	orientationWarningElement.style.display = shouldShow ? "flex" : "none";
	orientationWarningElement.setAttribute("aria-hidden", shouldShow ? "false" : "true");
}

function initializeGlobalInterface(runtime)
{
	hoverButtonEntries = new Map();
	hoveredButtonEntry = null;
	confettiParticles = [];
	setMouseCursor(runtime, "default");

	const menuButton = getFirstInstance(runtime, "btn_3nokta");
	const menuItems = [
		getFirstInstance(runtime, "btn_ev"),
		getFirstInstance(runtime, "btn_ses")
	].filter(Boolean).map(instance => ({
		instance,
		x: instance.x,
		y: instance.y,
		width: instance.width,
		height: instance.height
	}));

	utilityMenuState = menuButton ? {
		menuButton,
		items: menuItems,
		progress: 0,
		target: 0
	} : null;

	for (const item of menuItems)
	{
		item.instance.opacity = 0;
		item.instance.isVisible = false;
	}

	const soundButton = getFirstInstance(runtime, "btn_ses");
	if (soundButton)
		soundButton.animationFrame = isAudioMuted ? 1 : 0;

	syncHoverButtons(runtime);
}

function handleGlobalInterfaceClick(runtime, x, y)
{
	if (!utilityMenuState)
		return false;

	if (isInstanceHit(utilityMenuState.menuButton, x, y))
	{
		setUtilityMenuOpen(utilityMenuState.target === 0);
		return true;
	}

	const homeButton = getFirstInstance(runtime, "btn_ev");
	if (homeButton && isInstanceHit(homeButton, x, y))
	{
		runtime.goToLayout("giris");
		return true;
	}

	const soundButton = getFirstInstance(runtime, "btn_ses");
	if (soundButton && isInstanceHit(soundButton, x, y))
	{
		toggleProjectAudio(runtime, soundButton);
		return true;
	}

	return false;
}

function setUtilityMenuOpen(isOpen)
{
	if (!utilityMenuState)
		return;

	utilityMenuState.target = isOpen ? 1 : 0;
	if (isOpen)
	{
		for (const item of utilityMenuState.items)
		{
			const easedProgress = easeOutCubic(utilityMenuState.progress);
			item.instance.setPosition(
				utilityMenuState.menuButton.x + (item.x - utilityMenuState.menuButton.x) * easedProgress,
				utilityMenuState.menuButton.y + (item.y - utilityMenuState.menuButton.y) * easedProgress
			);
			item.instance.opacity = utilityMenuState.progress;
			item.instance.isVisible = true;
			item.instance.moveToTop();
		}
		utilityMenuState.menuButton.moveToTop();
	}
	else
	{
		for (const item of utilityMenuState.items)
		{
			const hoverEntry = hoverButtonEntries.get(item.instance.uid);
			if (hoverEntry)
				hoverEntry.target = 0;
		}
	}
}

function toggleProjectAudio(runtime, soundButton)
{
	isAudioMuted = !isAudioMuted;

	try
	{
		const audio = runtime.objects.Audio;
		if (audio && "isSilent" in audio)
		{
			audio.isSilent = isAudioMuted;
			isAudioMuted = audio.isSilent;
		}
	}
	catch (_error)
	{
		// Audio's script interface is unavailable in worker mode; keep the visual state.
	}

	soundButton.animationFrame = isAudioMuted ? 1 : 0;
}

function burstConfetti(runtime)
{
	const particleType = runtime.objects.nesne_oyun_bos;
	if (!particleType)
		return;

	const centerX = Number.isFinite(runtime.layout.width) ? runtime.layout.width / 2 : 960;
	const centerY = Number.isFinite(runtime.layout.height) ? runtime.layout.height / 2 : 540;
	const colors = [
		[1, 0.2, 0.2],
		[1, 0.82, 0.08],
		[0.12, 0.82, 1],
		[0.28, 1, 0.34],
		[1, 0.28, 0.78],
		[0.65, 0.3, 1]
	];

	for (let index = 0; index < 140; index++)
	{
		const direction = Math.random() * Math.PI * 2;
		const speed = 480 + Math.random() * 820;
		const instance = particleType.createInstance(0, centerX, centerY);
		confettiInstances.add(instance);
		instance.animationFrame = 0;
		instance.setSize(7 + Math.random() * 13, 5 + Math.random() * 8);
		instance.angle = Math.random() * Math.PI * 2;
		instance.colorRgb = colors[index % colors.length];
		instance.opacity = 1;
		instance.isCollisionEnabled = false;
		instance.moveToTop();

		confettiParticles.push({
			instance,
			velocityX: Math.cos(direction) * speed,
			velocityY: Math.sin(direction) * speed - 110,
			rotationSpeed: (Math.random() - 0.5) * 14,
			age: 0,
			lifetime: 1.65 + Math.random() * 0.75
		});
	}
}

function updateConfetti(runtime)
{
	if (confettiParticles.length === 0)
		return;

	const deltaTime = Math.min(runtime.dtRaw, 1 / 30);
	const activeParticles = [];

	for (const particle of confettiParticles)
	{
		particle.age += deltaTime;
		if (particle.age >= particle.lifetime)
		{
			particle.instance.destroy();
			continue;
		}

		particle.velocityY += 620 * deltaTime;
		particle.instance.offsetPosition(
			particle.velocityX * deltaTime,
			particle.velocityY * deltaTime
		);
		particle.instance.angle += particle.rotationSpeed * deltaTime;

		const lifeProgress = particle.age / particle.lifetime;
		particle.instance.opacity = lifeProgress < 0.62
			? 1
			: 1 - (lifeProgress - 0.62) / 0.38;

		activeParticles.push(particle);
	}

	confettiParticles = activeParticles;
}

function updateGlobalInterface(runtime)
{
	updateUtilityMenuAnimation(runtime);
	syncHoverButtons(runtime);
	updateButtonHoverAnimations(runtime);
	updateConfetti(runtime);
}

function updateUtilityMenuAnimation(runtime)
{
	const state = utilityMenuState;
	if (!state)
		return;

	const step = Math.min(1, runtime.dtRaw * 7.5);
	state.progress = moveTowards(state.progress, state.target, step);
	const easedProgress = easeOutCubic(state.progress);

	for (const item of state.items)
	{
		if (state.progress > 0)
			item.instance.isVisible = true;

		item.instance.setPosition(
			state.menuButton.x + (item.x - state.menuButton.x) * easedProgress,
			state.menuButton.y + (item.y - state.menuButton.y) * easedProgress
		);
		item.instance.opacity = state.progress;

		if (state.progress === 0)
		{
			item.instance.isVisible = false;
			item.instance.setPosition(item.x, item.y);
			item.instance.opacity = 1;
		}
	}
}

function syncHoverButtons(runtime)
{
	registerPointerEntries(runtime, hoverButtonObjectNames, true);
	registerPointerEntries(runtime, cursorObjectNames, false);
}

function registerPointerEntries(runtime, objectNames, hasHoverEffect)
{
	for (const objectName of objectNames)
	{
		for (const instance of getInstances(runtime, objectName))
		{
			if (hoverButtonEntries.has(instance.uid))
				continue;

			hoverButtonEntries.set(instance.uid, {
				instance,
				objectName,
				width: instance.width,
				height: instance.height,
				hasHoverEffect,
				progress: 0,
				target: 0,
				glow: null
			});
		}
	}
}

function updateHoveredButton(runtime, x, y, pointerType)
{
	syncHoverButtons(runtime);
	let nextHoveredEntry = null;

	if (pointerType !== "touch")
	{
		for (const entry of hoverButtonEntries.values())
		{
			if (!isPointerEntryEnabled(runtime, entry) ||
				!isInstanceHit(entry.instance, x, y))
				continue;

			if (!nextHoveredEntry || entry.instance.zIndex > nextHoveredEntry.instance.zIndex)
				nextHoveredEntry = entry;
		}
	}

	hoveredButtonEntry = nextHoveredEntry;
	for (const entry of hoverButtonEntries.values())
		entry.target = entry === hoveredButtonEntry ? 1 : 0;

	setMouseCursor(runtime, hoveredButtonEntry ? "pointer" : "default");
}

function updateButtonHoverAnimations(runtime)
{
	const time = runtime.tickCount * 0.08;
	let hoveredButtonStillVisible = false;

	for (const entry of hoverButtonEntries.values())
	{
		const instance = entry.instance;
		const isInteractive = instance.isVisible &&
			instance.layer.isSelfAndParentsVisible &&
			instance.layer.isSelfAndParentsInteractive &&
			isPointerEntryEnabled(runtime, entry);

		if (!isInteractive)
			entry.target = 0;
		if (entry === hoveredButtonEntry && isInteractive)
			hoveredButtonStillVisible = true;

		if (!entry.hasHoverEffect)
		{
			entry.progress = 0;
			continue;
		}

		entry.progress = moveTowards(
			entry.progress,
			entry.target,
			Math.min(1, runtime.dtRaw * 11)
		);

		const hoverProgress = easeOutCubic(entry.progress);
		const menuScale = getUtilityMenuItemScale(instance);
		const buttonScale = menuScale * (1 + hoverProgress * 0.08);
		instance.setSize(entry.width * buttonScale, entry.height * buttonScale);

		if (entry.progress > 0 && !entry.glow)
			entry.glow = createButtonGlow(runtime, entry);

		if (!entry.glow)
			continue;

		const glow = entry.glow;
		if (!isInteractive || entry.progress === 0)
		{
			glow.isVisible = false;
			continue;
		}

		const pulse = 0.88 + Math.sin(time) * 0.12;
		const glowScale = buttonScale + hoverProgress * 0.15;
		glow.animationFrame = instance.animationFrame;
		glow.setPosition(instance.x, instance.y);
		glow.setSize(entry.width * glowScale, entry.height * glowScale);
		glow.opacity = 0.3 * hoverProgress * pulse;
		glow.isVisible = true;
		glow.moveAdjacentToInstance(instance, false);
	}

	if (hoveredButtonEntry && !hoveredButtonStillVisible)
	{
		hoveredButtonEntry = null;
		setMouseCursor(runtime, "default");
	}
}

function isPointerEntryEnabled(runtime, entry)
{
	const layoutName = runtime.layout.name;
	const instance = entry.instance;

	if (entry.objectName === "nesne_oyun1")
		return layoutName === "oyun1";

	if (["nesne_oyun2", "nesne_oyun3", "nesne_oyun4"].includes(entry.objectName))
	{
		return Boolean(
			journeyState &&
			layoutName === journeyState.config.overviewLayout + "_1" &&
			!journeyState.completed &&
			!journeyState.hintVisible &&
			!journeyState.selected.includes(instance)
		);
	}

	if (entry.objectName === "nesne_oyun5")
	{
		return Boolean(
			layoutName === "oyun5" &&
			classificationState &&
			!classificationState.completed &&
			!classificationState.hintVisible &&
			(
				classificationState.currentCard === instance ||
				classificationState.placedCards.some(card => card.instance === instance)
			)
		);
	}

	if (entry.objectName === "oyun6_cevaplar" || entry.objectName === "oyun6_abc")
	{
		return Boolean(
			layoutName === "oyun6" &&
			multipleChoiceState &&
			!multipleChoiceState.resolved &&
			!multipleChoiceState.hintVisible
		);
	}

	return true;
}

function createButtonGlow(runtime, entry)
{
	const objectType = runtime.objects[entry.objectName];
	if (!objectType)
		return null;

	const glow = objectType.createInstance(entry.instance.layer.index, entry.instance.x, entry.instance.y);
	hoverGlowInstances.add(glow);
	glow.animationFrame = entry.instance.animationFrame;
	glow.setSize(entry.width, entry.height);
	glow.opacity = 0;
	glow.isVisible = false;
	glow.isCollisionEnabled = false;
	glow.colorRgb = [0.55, 0.85, 1];
	glow.blendMode = "additive";
	glow.moveAdjacentToInstance(entry.instance, false);
	return glow;
}

function getUtilityMenuItemScale(instance)
{
	if (!utilityMenuState)
		return 1;

	const isMenuItem = utilityMenuState.items.some(item => item.instance === instance);
	if (!isMenuItem)
		return 1;

	return 0.68 + easeOutCubic(utilityMenuState.progress) * 0.32;
}

function setMouseCursor(runtime, style)
{
	if (runtime.mouse)
		runtime.mouse.setCursorStyle(style);
}

function moveTowards(value, target, maximumDelta)
{
	if (value < target)
		return Math.min(target, value + maximumDelta);
	return Math.max(target, value - maximumDelta);
}

function easeOutCubic(value)
{
	return 1 - Math.pow(1 - value, 3);
}

function goHomeIfRequested(runtime, x, y)
{
	if (isObjectHit(runtime, "btn_ev", x, y))
		runtime.goToLayout("giris");
}

function setObjectVisibility(runtime, objectName, isVisible)
{
	for (const instance of getInstances(runtime, objectName))
		instance.isVisible = isVisible;
}

function isObjectHit(runtime, objectName, x, y)
{
	const instances = getInstances(runtime, objectName);
	for (let index = instances.length - 1; index >= 0; index--)
	{
		if (isInstanceHit(instances[index], x, y))
			return true;
	}

	return false;
}

function isInstanceHit(instance, x, y)
{
	if (!instance ||
		!instance.isVisible ||
		!instance.layer.isSelfAndParentsVisible ||
		!instance.layer.isSelfAndParentsInteractive)
		return false;

	if (instance.containsPoint(x, y))
		return true;

	if (!useExpandedTouchTargets || !hoverButtonEntries.has(instance.uid))
		return false;

	const touchWidth = Math.max(Math.abs(instance.width), 112);
	const touchHeight = Math.max(Math.abs(instance.height), 112);
	return Math.abs(x - instance.x) <= touchWidth / 2 &&
		Math.abs(y - instance.y) <= touchHeight / 2;
}

function getInstances(runtime, objectName)
{
	const objectType = runtime.objects[objectName];
	return objectType
		? objectType.getAllInstances().filter(instance =>
			!hoverGlowInstances.has(instance) &&
			!confettiInstances.has(instance))
		: [];
}

function getFirstInstance(runtime, objectName)
{
	return getInstances(runtime, objectName)[0] ?? null;
}

function findNearestInstance(source, candidates)
{
	let nearest = null;
	let nearestDistanceSquared = Infinity;

	for (const candidate of candidates)
	{
		const dx = source.x - candidate.x;
		const dy = source.y - candidate.y;
		const distanceSquared = dx * dx + dy * dy;

		if (distanceSquared < nearestDistanceSquared)
		{
			nearest = candidate;
			nearestDistanceSquared = distanceSquared;
		}
	}

	return nearest;
}

function createClassificationSequence()
{
	let sequence;

	do
	{
		sequence = shuffledIndices(classificationCardFrames.length);
	}
	while (
		lastClassificationSequence &&
		sequence.every((value, index) => value === lastClassificationSequence[index])
	);

	lastClassificationSequence = [...sequence];
	return sequence;
}

function createMultipleChoiceSequence()
{
	let sequence;

	do
	{
		sequence = shuffledIndices(multipleChoiceAnswerFrames.length);
	}
	while (
		lastMultipleChoiceSequence &&
		sequence.every((value, index) => value === lastMultipleChoiceSequence[index])
	);

	lastMultipleChoiceSequence = [...sequence];
	return sequence;
}

function shuffledIndices(count)
{
	const values = Array.from({ length: count }, (_unused, index) => index);

	do
	{
		for (let index = values.length - 1; index > 0; index--)
		{
			const randomIndex = Math.floor(Math.random() * (index + 1));
			[values[index], values[randomIndex]] = [values[randomIndex], values[index]];
		}
	}
	while (values.every((value, index) => value === index));

	return values;
}
