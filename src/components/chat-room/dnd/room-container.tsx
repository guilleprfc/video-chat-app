import * as React from 'react'
import { useState } from 'react'
import RLDD from 'react-list-drag-and-drop/lib/RLDD'

interface Item {
  id: number
  display: string
}

interface RoomContainerProps {
  info
  data
}

const RoomContainer: React.FC<RoomContainerProps> = ({ info, data }) => {
  const [items, setItems] = useState<Item[]>(data)

  const itemRenderer = (item: Item, index: number): JSX.Element => {
    return (
      <div className="participants">
        <div className="participant">
        {index} - {item.display}
        </div>
      </div>
    )
  }

  const handleRLDDChange = (reorderedItems: Array<Item>) => {
    console.log('handleRLDDChange')
    console.log(reorderedItems)
    // TODO Detect which user has been moved to which room and make the user switch
    // between those rooms in the Janus server
    // ...

    setItems(reorderedItems)
  }

  return (
    <div className="chat__room">
      <p className="mt-3 mb-2 text-tertiary chat__room-name">{info}</p>
      <RLDD
        cssClasses="chat__room-container"
        items={items}
        itemRenderer={itemRenderer}
        onChange={handleRLDDChange}
      />
    </div>
  )
}

export default RoomContainer
