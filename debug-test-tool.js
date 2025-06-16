// Updated debugging version to match original structure more closely
const AQuizThatRanksNeighborhoodsForHomeBuyersBasedOnTheirPrioritiesLikeSchoolsPriceAndCommute = () => {
  console.log('🔧 DEBUG: Component rendering...');
  
  const [statePrioritySchools, setStatePrioritySchools] = useState([5]);
  const [statePriorityPrice, setStatePriorityPrice] = useState([5]);
  const [statePriorityCommute, setStatePriorityCommute] = useState([5]);
  const [stateYourBudget, setStateYourBudget] = useState('');
  const [neighborhoodScore, setNeighborhoodScore] = useState(0);

  console.log('🔧 DEBUG: Current state in render:', {
    schools: statePrioritySchools,
    price: statePriorityPrice,
    commute: statePriorityCommute,
    budget: stateYourBudget,
    score: neighborhoodScore
  });

  const handlePriorityChange = (values, type) => {
    console.log('🔧 DEBUG: handlePriorityChange called with:', values, type);
    if (type === 'schools') setStatePrioritySchools(values);
    if (type === 'price') setStatePriorityPrice(values);
    if (type === 'commute') setStatePriorityCommute(values);
  };

  const handleBudgetInput = (e) => {
    console.log('🔧 DEBUG: handleBudgetInput called with:', e.target.value);
    setStateYourBudget(e.target.value);
  };

  const handleStartQuiz = () => {
    console.log('🔧 DEBUG: *** handleStartQuiz CALLED! ***');
    console.log('🔧 DEBUG: About to call calculateNeighborhoodScore...');
    calculateNeighborhoodScore();
    console.log('🔧 DEBUG: calculateNeighborhoodScore call completed');
  };

  const handleViewResults = () => {
    console.log('🔧 DEBUG: handleViewResults called');
  };

  const calculateNeighborhoodScore = () => {
    console.log('🔧 DEBUG: *** calculateNeighborhoodScore FUNCTION STARTED ***');
    
    const schoolsWeight = statePrioritySchools[0] / 10;
    const priceWeight = statePriorityPrice[0] / 10;
    const commuteWeight = statePriorityCommute[0] / 10;
    const budget = parseFloat(stateYourBudget);
    
    console.log('🔧 DEBUG: Calculation inputs:', {
      statePrioritySchools,
      statePriorityPrice, 
      statePriorityCommute,
      stateYourBudget,
      schoolsWeight,
      priceWeight,
      commuteWeight,
      budget,
      budgetIsValid: !isNaN(budget) && budget > 0
    });
    
    if (isNaN(budget) || budget <= 0) {
      console.error('🔧 DEBUG: Invalid budget, returning early');
      return;
    }
    
    const maxScore = 100;
    const weightedSchoolsScore = maxScore * schoolsWeight;
    const weightedPriceScore = maxScore * priceWeight;
    const weightedCommuteScore = maxScore * commuteWeight;
    const totalWeightedScore = weightedSchoolsScore + weightedPriceScore + weightedCommuteScore;
    const neighborhoodScore = totalWeightedScore / 3;
    
    console.log('🔧 DEBUG: Calculation results:', {
      weightedSchoolsScore,
      weightedPriceScore,
      weightedCommuteScore,
      totalWeightedScore,
      neighborhoodScore
    });
    
    setNeighborhoodScore(neighborhoodScore);
    console.log('🔧 DEBUG: *** calculateNeighborhoodScore COMPLETED - Score set to:', neighborhoodScore);
  };

  console.log('🔧 DEBUG: About to return JSX...');

  // Test the click handler binding
  console.log('🔧 DEBUG: handleStartQuiz function:', handleStartQuiz);
  console.log('🔧 DEBUG: typeof handleStartQuiz:', typeof handleStartQuiz);

  return React.createElement('main', {
    className: 'bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 min-h-screen p-4 sm:p-6 md:p-8',
    'data-style-id': 'main-container',
    'data-tool-container': 'true',
    key: 'main-container'
  }, [
    React.createElement('div', {
      style: { 
        backgroundColor: '#374151', 
        padding: '15px', 
        marginBottom: '20px', 
        borderRadius: '8px',
        color: 'white'
      },
      key: 'debug-panel'
    }, [
      React.createElement('h3', { key: 'debug-title' }, '🔧 DEBUG PANEL'),
      React.createElement('p', { key: 'debug-schools' }, `Schools: ${statePrioritySchools[0]}`),
      React.createElement('p', { key: 'debug-price' }, `Price: ${statePriorityPrice[0]}`),
      React.createElement('p', { key: 'debug-commute' }, `Commute: ${statePriorityCommute[0]}`),
      React.createElement('p', { key: 'debug-budget' }, `Budget: ${stateYourBudget || 'Not set'}`),
      React.createElement('p', { key: 'debug-score' }, `Score: ${neighborhoodScore}`)
    ]),
    React.createElement('button', {
      onClick: () => {
        console.log('🔧 DEBUG: Direct button onClick fired!');
        handleStartQuiz();
      },
      style: {
        backgroundColor: '#3b82f6',
        color: 'white',
        padding: '12px 24px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '16px',
        marginRight: '10px'
      },
      key: 'debug-start-button'
    }, 'DEBUG Start Quiz'),
    React.createElement('input', {
      type: 'number',
      placeholder: 'Enter budget (e.g., 300000)',
      value: stateYourBudget,
      onChange: handleBudgetInput,
      style: {
        padding: '10px',
        marginLeft: '10px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        width: '200px'
      },
      key: 'debug-budget-input'
    }),
    React.createElement('div', {
      style: { marginTop: '20px', color: 'white' },
      key: 'score-display'
    }, neighborhoodScore > 0 ? `CALCULATED SCORE: ${neighborhoodScore.toFixed(2)}` : 'No score calculated yet')
  ]);
};

export default AQuizThatRanksNeighborhoodsForHomeBuyersBasedOnTheirPrioritiesLikeSchoolsPriceAndCommute; 