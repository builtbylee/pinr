export interface TriviaQuestion {
    id: string;
    text: string;
    options: string[]; // 4 options
    correctAnswer: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: 'culture' | 'food' | 'geography' | 'landmarks';
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
    // EASY
    { id: 't1', text: 'Which country is home to the Eiffel Tower?', options: ['France', 'Italy', 'Spain', 'Germany'], correctAnswer: 'France', difficulty: 'easy', category: 'landmarks' },
    { id: 't2', text: 'Sushi is a traditional dish from which country?', options: ['China', 'Japan', 'Thailand', 'Korea'], correctAnswer: 'Japan', difficulty: 'easy', category: 'food' },
    { id: 't3', text: 'In which city would you find the Statue of Liberty?', options: ['Washington D.C.', 'New York City', 'Los Angeles', 'Chicago'], correctAnswer: 'New York City', difficulty: 'easy', category: 'landmarks' },
    { id: 't4', text: 'What is the largest ocean in the world?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctAnswer: 'Pacific', difficulty: 'easy', category: 'geography' },
    { id: 't5', text: 'Which country is famous for its pyramids?', options: ['Mexico', 'Peru', 'Egypt', 'Sudan'], correctAnswer: 'Egypt', difficulty: 'easy', category: 'landmarks' },
    { id: 't6', text: 'Pizza originated in which country?', options: ['USA', 'France', 'Italy', 'Greece'], correctAnswer: 'Italy', difficulty: 'easy', category: 'food' },
    { id: 't7', text: 'Which continent is the Sahara Desert located in?', options: ['Asia', 'South America', 'Africa', 'Australia'], correctAnswer: 'Africa', difficulty: 'easy', category: 'geography' },
    { id: 't8', text: 'What is the capital of the United Kingdom?', options: ['Edinburgh', 'Dublin', 'London', 'Cardiff'], correctAnswer: 'London', difficulty: 'easy', category: 'geography' },
    { id: 't9', text: 'Which country has a kangaroo as its national symbol?', options: ['Austria', 'South Africa', 'Australia', 'New Zealand'], correctAnswer: 'Australia', difficulty: 'easy', category: 'culture' },
    { id: 't10', text: 'The Great Wall is located in which country?', options: ['Japan', 'India', 'China', 'Mongolia'], correctAnswer: 'China', difficulty: 'easy', category: 'landmarks' },

    // MEDIUM
    { id: 't11', text: 'Which country is known as the Land of Smiles?', options: ['Vietnam', 'Thailand', 'Cambodia', 'Laos'], correctAnswer: 'Thailand', difficulty: 'medium', category: 'culture' },
    { id: 't12', text: 'Machu Picchu is an ancient Incan city in which country?', options: ['Bolivia', 'Chile', 'Ecuador', 'Peru'], correctAnswer: 'Peru', difficulty: 'medium', category: 'landmarks' },
    { id: 't13', text: 'Which European city is built on 118 small islands?', options: ['Amsterdam', 'Venice', 'Stockholm', 'Copenhagen'], correctAnswer: 'Venice', difficulty: 'medium', category: 'geography' },
    { id: 't14', text: 'Pho is a popular noodle soup from which country?', options: ['China', 'Japan', 'Vietnam', 'Malaysia'], correctAnswer: 'Vietnam', difficulty: 'medium', category: 'food' },
    { id: 't15', text: 'Which country has the most time zones?', options: ['Russia', 'USA', 'China', 'France'], correctAnswer: 'France', difficulty: 'medium', category: 'geography' }, // France has 12 due to overseas territories
    { id: 't16', text: 'The Parthenon is a temple dedicated to which Greek goddess?', options: ['Hera', 'Aphrodite', 'Athena', 'Artemis'], correctAnswer: 'Athena', difficulty: 'medium', category: 'culture' },
    { id: 't17', text: 'What is the currency of Japan?', options: ['Won', 'Yuan', 'Yen', 'Ringgit'], correctAnswer: 'Yen', difficulty: 'medium', category: 'culture' },
    { id: 't18', text: 'Haggis is a traditional pudding from which country?', options: ['Ireland', 'Wales', 'Scotland', 'England'], correctAnswer: 'Scotland', difficulty: 'medium', category: 'food' },
    { id: 't19', text: 'Which city is the capital of Canada?', options: ['Toronto', 'Montreal', 'Vancouver', 'Ottawa'], correctAnswer: 'Ottawa', difficulty: 'medium', category: 'geography' },
    { id: 't20', text: 'The Taj Mahal was built by which emperor?', options: ['Akbar', 'Jahangir', 'Shah Jahan', 'Aurangzeb'], correctAnswer: 'Shah Jahan', difficulty: 'medium', category: 'landmarks' },

    // HARD
    { id: 't21', text: 'What is the only country in the world without a capital city?', options: ['Monaco', 'Nauru', 'Vatican City', 'San Marino'], correctAnswer: 'Nauru', difficulty: 'hard', category: 'geography' },
    { id: 't22', text: 'Which country eats the most chocolate per capita?', options: ['Belgium', 'USA', 'Germany', 'Switzerland'], correctAnswer: 'Switzerland', difficulty: 'hard', category: 'food' },
    { id: 't23', text: 'The "Door to Hell" is a burning gas crater located in which country?', options: ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Iran'], correctAnswer: 'Turkmenistan', difficulty: 'hard', category: 'landmarks' },
    { id: 't24', text: 'Which country has the most lakes in the world?', options: ['Canada', 'Finland', 'Sweden', 'Russia'], correctAnswer: 'Canada', difficulty: 'hard', category: 'geography' },
    { id: 't25', text: 'What is the national animal of Scotland?', options: ['Lion', 'Falcon', 'Unicorn', 'Stag'], correctAnswer: 'Unicorn', difficulty: 'hard', category: 'culture' },
    { id: 't26', text: 'Which city is known as the "City of a Hundred Spires"?', options: ['Prague', 'Budapest', 'Vienna', 'Krakow'], correctAnswer: 'Prague', difficulty: 'hard', category: 'culture' },
    { id: 't27', text: 'What is the oldest active volcano in Italy?', options: ['Vesuvius', 'Stromboli', 'Etna', 'Vulcano'], correctAnswer: 'Etna', difficulty: 'hard', category: 'geography' },
    { id: 't28', text: 'The ancient city of Petra is located in which country?', options: ['Syria', 'Iraq', 'Jordan', 'Lebanon'], correctAnswer: 'Jordan', difficulty: 'hard', category: 'landmarks' },
    { id: 't29', text: 'Which country has the most islands?', options: ['Philippines', 'Indonesia', 'Sweden', 'Finland'], correctAnswer: 'Sweden', difficulty: 'hard', category: 'geography' },
    { id: 't30', text: 'Kimchi is traditionally fermented in what type of vessel?', options: ['Onggi', 'Hangari', 'Ttukbaegi', 'Kame'], correctAnswer: 'Onggi', difficulty: 'hard', category: 'food' },
];
