import { NextResponse } from 'next/server';

export async function GET() {
    const voices = [
        { id: 'Kore', name: 'Kore', gender: 'female' },
        { id: 'Zephyr', name: 'Zephyr', gender: 'female' },
        { id: 'Aoede', name: 'Aoede', gender: 'female' },
        { id: 'Leda', name: 'Leda', gender: 'female' },
        { id: 'Puck', name: 'Puck', gender: 'male' },
        { id: 'Charon', name: 'Charon', gender: 'male' },
        { id: 'Fenrir', name: 'Fenrir', gender: 'male' },
        { id: 'Orus', name: 'Orus', gender: 'male' },
        { id: 'Achernar', name: 'Achernar' },
        { id: 'Achird', name: 'Achird' },
        { id: 'Algenib', name: 'Algenib' },
        { id: 'Algieba', name: 'Algieba' },
        { id: 'Alnilam', name: 'Alnilam' },
        { id: 'Autonoe', name: 'Autonoe' },
        { id: 'Callirrhoe', name: 'Callirrhoe' },
        { id: 'Despina', name: 'Despina' },
        { id: 'Enceladus', name: 'Enceladus' },
        { id: 'Erinome', name: 'Erinome' },
        { id: 'Gacrux', name: 'Gacrux' },
        { id: 'Iapetus', name: 'Iapetus' },
        { id: 'Laomedeia', name: 'Laomedeia' },
        { id: 'Pulcherrima', name: 'Pulcherrima' },
        { id: 'Rasalgethi', name: 'Rasalgethi' },
        { id: 'Sadachbia', name: 'Sadachbia' },
        { id: 'Sadaltager', name: 'Sadaltager' },
        { id: 'Schedar', name: 'Schedar' },
        { id: 'Sulafat', name: 'Sulafat' },
        { id: 'Umbriel', name: 'Umbriel' },
        { id: 'Vindemiatrix', name: 'Vindemiatrix' },
        { id: 'Zubenelgenubi', name: 'Zubenelgenubi' }
    ];
    return NextResponse.json(voices);
}
