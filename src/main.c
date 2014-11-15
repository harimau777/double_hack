//Based onhttps://github.com/pebble-examples/watchface-tutorial/blob/master/src/watchface-tutorial.c
//Based on http://ninedof.wordpress.com/pebble-sdk-tutorial/
#include <pebble.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

//**********************************************
//********** Function Header **********
//**********************************************
void stopsLite(int routeID);
void routesLite();
void eta(int routeID, int stopID);
void parse_stopsLite(DictionaryIterator *iter);
void parse_routesLite(DictionaryIterator *iter);
void parse_eta(DictionaryIterator *iter);

char * itoa(int input, char * buffer, int basesize){
    int reductio = input;
    int length = 0;
    if ( input == 0)
      return "0";

    while(reductio != 0){
        buffer[length++] = (char)reductio%basesize;
        reductio /= basesize;
    } //end while

    char * result = malloc((length+1)*sizeof(char));
    for(int k=0; k < length; k++){
      result[k] = buffer[ length-1-k ];
    }
    result[length]='\0';
    return result;
}

//**********************************************
//********** Global Variables **********
//**********************************************
DictionaryIterator routesIter;
DictionaryIterator stopsIter;
uint32_t ETA_minutes;
char * dm_platform = "uc";
uint32_t route_number;
uint32_t stop_number;

static Window *s_route_window;
static Window *s_stop_window;
static Window *s_eta_window;

//Fonts:
static GFont s_font;

//**********************************************
//********** Menus and Menu Functions **********
//**********************************************

//***** Route Menu *****
MenuLayer *route_menu_layer;

void route_draw_row_callback(GContext *ctx, Layer *cell_layer, MenuIndex *cell_index, void *callback_context)
{
	int count=0;
	//char buffer [33];
	Tuple* t = dict_read_first(&routesIter);
	while( t != NULL )
	{
		if( cell_index->row == count )
		{
			menu_cell_basic_draw(ctx, cell_layer, t->value->cstring, "", NULL);
			break;
		}
		t = dict_read_next(&routesIter);
	}
}

uint16_t route_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *callback_context)
{
	uint16_t count=0;
	Tuple* t = dict_read_first(&routesIter);
	while( t != NULL )
	{
		count++;
		t = dict_read_next(&routesIter);
	}
	//Tuple* t = dict_read_first(&routesIter);
	//return dict_size(routesIter) / (sizeof(t->key)+sizeof(t->value));
	return count;
}

void route_select_click_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *callback_context)
{
	int count=0;
	Tuple* t = dict_read_first(&routesIter);
	while( t != NULL )
	{
		if( cell_index->row == count )
		{
			route_number = (int)t->value->data;
			break;
		}
		t = dict_read_next(&routesIter);
	}

	//push call for request data for stops
	stopsLite(route_number);
	//load next menu screen
	window_stack_push(s_stop_window, true);

	/*
	//Get which row
	int which = cell_index->row;

	//Moneysmith: This is all from the example.We will need to change it so that it selects the proper route.
	//The array that will hold the on/off vibration timesuint32_t segments[16] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,0, 0};

	//Build the pattern (milliseconds on and off in alternating positions)
	for(int i = 0; i < which + 1; i++)
	{
		segments[2 * i] = 200;
		segments[(2 * i) + 1] = 100;
	}

	//Create a VibePattern data structure
	VibePattern pattern =
	{
		.durations = segments,
		.num_segments = 16
	};

	//Do the vibration pattern!
	vibes_enqueue_custom_pattern(pattern);
	*/
}

//***** Stops Menu *****
MenuLayer *stop_menu_layer;

void stop_draw_row_callback(GContext *ctx, Layer *cell_layer, MenuIndex *cell_index, void *callback_context)
{
	int count=0;
	Tuple* t = dict_read_first(&stopsIter);
	while( t != NULL )
	{
		if( cell_index->row == count )
		{
			menu_cell_basic_draw(ctx, cell_layer, t->value->cstring, "", NULL);
			break;
		}
		t = dict_read_next(&stopsIter);
	}
}

uint16_t stop_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *callback_context)
{
	uint16_t count=0;
	Tuple* t = dict_read_first(&stopsIter);
	while( t != NULL )
	{
		count++;
		t = dict_read_next(&stopsIter);
	}
	//Tuple* t = dict_read_first(&routesIter);
	//return dict_size(routesIter) / (sizeof(t->key)+sizeof(t->value));
	return count;
}

void stop_select_click_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *callback_context)
{
	//push call for request data for eta
	int count=0;
	Tuple* t = dict_read_first(&stopsIter);
	while( t != NULL )
	{
		if( cell_index->row == count )
		{
			stop_number = (int)t->value; //JWC (int)
			break;
		}
		t = dict_read_next(&routesIter);
	}
	eta(route_number, stop_number);
	//load next menu screen
	window_stack_push(s_eta_window, true);

	/*
	//Get which row
	int which = cell_index->row;

	//Moneysmith: This is all from the example.We will need to change it so that it selects the proper stop.
	//The array that will hold the on/off vibration times uint32_t segments[16] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

	//Build the pattern (milliseconds on and off in alternating positions)
	for(int i = 0; i < which + 1; i++)
	{
		segments[2 * i] = 200;
		segments[(2 * i) + 1] = 100;
	}

	//Create a VibePattern data structure
	VibePattern pattern =
	{
		.durations = segments,
		.num_segments = 16
	};

	//Do the vibration pattern!
	vibes_enqueue_custom_pattern(pattern);
	*/
}

//**************************************************
//********** Windows and Window Functions **********
//**************************************************

//***** Route Select Window *****
static void route_window_load(Window *window)
{
	//Create it - 12 is approx height of the top bar
	route_menu_layer = menu_layer_create(GRect(0, 0, 144, 168 - 16));

	//Let it receive clicks
	menu_layer_set_click_config_onto_window(route_menu_layer, s_route_window);

	//Give it its callbacks
	MenuLayerCallbacks callbacks =
	{
			.draw_row = (MenuLayerDrawRowCallback) route_draw_row_callback,
			.get_num_rows = (MenuLayerGetNumberOfRowsInSectionsCallback) route_num_rows_callback,
			.select_click = (MenuLayerSelectCallback) route_select_click_callback
	};
	menu_layer_set_callbacks(route_menu_layer, NULL, callbacks);

	//Add to Window
	layer_add_child(window_get_root_layer(s_route_window),menu_layer_get_layer(route_menu_layer));
}

static void route_window_unload(Window *window)
{
	//Unload GFont
	fonts_unload_custom_font(s_font);

	//Destroy Menu Layer
	menu_layer_destroy(route_menu_layer);
	// ___ TODO: anymore unloads?
}

//***** Stop Select Window *****
static void stop_window_load(Window *window)
{
	//Create it - 12 is approx height of the top bar
	stop_menu_layer = menu_layer_create(GRect(0, 0, 144, 168 - 16));

	//Let it receive clicks
	menu_layer_set_click_config_onto_window(stop_menu_layer, s_stop_window);

	//Give it its callbacks
	MenuLayerCallbacks callbacks =
	{
		.draw_row = (MenuLayerDrawRowCallback) stop_draw_row_callback,
		.get_num_rows = (MenuLayerGetNumberOfRowsInSectionsCallback) stop_num_rows_callback,
		.select_click = (MenuLayerSelectCallback) stop_select_click_callback
	};
	menu_layer_set_callbacks(stop_menu_layer, NULL, callbacks);

	//Add to Window
	layer_add_child(window_get_root_layer(s_stop_window), menu_layer_get_layer(stop_menu_layer));
}

static void stop_window_unload(Window *window)
{
	//Unload GFont
	fonts_unload_custom_font(s_font);

	//Destroy Menu Layer
	menu_layer_destroy(stop_menu_layer);
	// ___ TODO: anymore unloads?
}

//***** ETA Window *****
static TextLayer *s_eta_layer;
static TextLayer *s_time_layer;

static void eta_window_load(Window *window)
{

}

static void eta_window_unload(Window *window)
{
	//Unload GFont
	fonts_unload_custom_font(s_font);

	// Destroy TextLayers
	text_layer_destroy(s_eta_layer);
	text_layer_destroy(s_time_layer);
}

//*************************************
//********** Event Functions **********
//*************************************

//***** Define Keys *****
#define FUNCTION_KEY 0//key for function/data type being passed
//These can serve as keys or values paired with FUNCTION_KEY
#define ROUTESLITE 0
#define STOPSLITE 1
#define ETA 2
#define ROUTEID 1
#define STOPID 2


//***** Define Buffers *****
char route_buffer[32], stop_buffer[32], eta_buffer[32];

//JWC why not use a single buffer?
#define	JWCBUFFERSIZE	100
char JWC_buffer[JWCBUFFERSIZE];

//***** Recieve Handler*****
static void in_received_handler(DictionaryIterator *iter, void *context)
{
//ninedof.wordpress.com/2014/02/02/pebble-sdk-2-0-tutorial-6-appmessage-for-pebblekit-js/
	(void) context;

	//Get data
	//Tuple *t = dict_read_first(iter);
	Tuple *t = dict_find(iter,FUNCTION_KEY);

	if (t->key == FUNCTION_KEY)
	{
		switch( (int) t->value->data )
		{
		case ROUTESLITE:
			parse_routesLite(iter);
			break;
		case STOPSLITE:
			parse_stopsLite(iter);
			break;
		case ETA:
			parse_eta(iter);
			break;
		default:
			//error TODO
			break;
		}
	}
	else
	{
		//error TODO
	}

} //end in_received_handler

//***** Process Tuple *****
/*
void process_tuple(Tuple *t)
{
//ninedof.wordpress.com/2014/02/02/pebble-sdk-2-0-tutorial-6-appmessage-for-pebblekit-js/
	//Get key
	int key = t->key;

	//Get integer value, if present
	int value = t->value->int32;

	//Get string value, if present
	char string_value[32];
	strcpy(string_value, t->value->cstring);

	//Decide what to do
	switch(key)
	{
	case KEY_ROUTE:
		routesLite(___)
		break;
	case KEY_STOP:
		stopsLite(___)
		break;
	case KEY_ETA:
		eta(___)
		break;
	}
}
*/

//***** Dropped Handler *****
static void in_dropped_handler(AppMessageResult reason, void *context)
{

}

//***** Out Failed Handler *****
static void out_failed_handler(DictionaryIterator *failed,
AppMessageResult reason, void *context)
{

}

//***************************************
//********** Utility Functions **********
//***************************************

//***** Parse Dictionary *****
/*
___ parseRoutes(___)
{
	//NOTE: This is example code!
	//Code based on: developer.getpebble.com/docs/c/group___dictionary.html
	Tuple *tuple = dict_read_begin_from_buffer(&iter, buffer, final_size);
	while (tuple)
	{
		switch (tuple->key)
		{
		case SOME_DATA_KEY:
			foo(tuple->value->data, tuple->length);
			break;
		case SOME_STRING_KEY:
			bar(tuple->value->cstring);
			break;
		}
		tuple = dict_read_next(&iter);
	}
}
*/

void parse_routesLite(DictionaryIterator *iter)
{
	Tuple *t = dict_read_first(iter);
	dict_write_begin(&routesIter, (uint8_t *) JWC_buffer, JWCBUFFERSIZE);

	while(t != NULL)
	{
		dict_write_data(&routesIter, t->key, (uint8_t *) t->value->cstring, sizeof(t->value->cstring));
		 //Get next
		 t = dict_read_next(iter);
	}
	return;
}

void parse_stopsLite(DictionaryIterator *iter)
{
	Tuple *t = dict_read_first(iter);
	dict_write_begin(&stopsIter, (uint8_t *) JWC_buffer, JWCBUFFERSIZE);

	while(t != NULL)
	{
		dict_write_data(&stopsIter, t->key, (uint8_t *) t->value->cstring, sizeof(t->value->cstring));
		 //Get next
		 t = dict_read_next(iter);
	}
	return;
}

void parse_eta(DictionaryIterator *iter)
{
	ETA_minutes = (uint32_t)(dict_find(iter, ETA))->value->data;
	return;
}

//*********************************************
//********** Communication Functions **********
//*********************************************

//***** Route Function *****
void routesLite()
{
	DictionaryIterator *tempIter;
	//AppMessageResult result = 
  app_message_outbox_begin(&tempIter);
	//dict_write_begin(&tempIter, JWC_buffer, JWCBUFFERSIZE);

	dict_write_data(tempIter, FUNCTION_KEY, ROUTESLITE, sizeof(ROUTESLITE));

	//Send data to phone as data request
	//result = 
  app_message_outbox_send();
	//wait on event to pass back
	//post please wait message

	//Moneysmith
//	___Set the number of rows in the routes menu___
//	___Set the text of the rows in the routes menu___
}

//***** Stop Function *****
void stopsLite(int routeID)
{
	DictionaryIterator *tempIter;
	AppMessageResult result = app_message_outbox_begin(&tempIter);
	//dict_write_begin(&tempIter, JWC_buffer, JWCBUFFERSIZE);

	dict_write_data(tempIter, 
     (uint32_t) FUNCTION_KEY, 
      itoa(STOPSLITE,eta_buffer,10), 
      sizeof(STOPSLITE));
	dict_write_data(tempIter, 
      (uint32_t) ROUTEID, 
      itoa(routeID,eta_buffer,10), 
      sizeof(routeID));

	//Send data to phone as data request
	result = app_message_outbox_send();
	//wait on event to pass back
	//post please wait message
	//Moneysmith
//	___Set the number of rows in the stops menu___
//	___set the text of the rows in the stops menu___
}

//***** ETA Function *****
void eta(int routeID, int stopID)
{
	DictionaryIterator *tempIter;
	AppMessageResult result = app_message_outbox_begin(&tempIter);
	//dict_write_begin(&tempIter, JWC_buffer, JWCBUFFERSIZE);

	dict_write_data(tempIter, FUNCTION_KEY, itoa(ETA,eta_buffer,10), sizeof(ETA));
	dict_write_data(tempIter, ROUTEID, itoa(routeID,eta_buffer,10), sizeof(routeID));
	dict_write_data(tempIter, STOPID, itoa(stopID,eta_buffer,10), sizeof(stopID));

	//Send data to phone as data request
	result = app_message_outbox_send();
	//wait on event to pass back
	//post please wait message
}

//***********************************************
//********** Primary Control Functions **********
//***********************************************

//***** Init Function *****
void init(void)
{
	//Initialize windows:
	s_route_window = window_create();
	window_set_window_handlers(s_route_window, (WindowHandlers)
	{
		.load = route_window_load,
		.unload = route_window_unload
	});
	s_stop_window = window_create();
	window_set_window_handlers(s_stop_window, (WindowHandlers)
	{
		.load = stop_window_load,
		.unload = stop_window_unload
	});
	s_eta_window = window_create();
	window_set_window_handlers(s_eta_window, (WindowHandlers)
	{
		.load = eta_window_load,
		.unload = eta_window_unload
	});

	//call dataRequest for routes TODO
	routesLite();

	//Moneysmith: Does this need to be before routesLite()?
	//Register AppMessage events
	app_message_register_inbox_received(in_received_handler);
	app_message_open(app_message_inbox_size_maximum(),
	app_message_outbox_size_maximum());	 //Largest possible input and output buffer sizes

	//Push windows to the stack:
	//Moneysmith:	 This may be outmatically displaying these windows (the example code only has one window).
	//		We may need to instead call this function when we want a specific window to be displayed.
	window_stack_push(s_route_window, true);
}

//***** De-init Function *****
void deinit()
{
	window_destroy(s_route_window);
	window_destroy(s_stop_window);
	window_destroy(s_eta_window);
}

//***** Main Function *****
int main(void)
{
	// do set up here
	init();
	//http://ninedof.wordpress.com/2014/02/02/pebble-sdk-2-0-tutorial-6-appmessage-for-pebblekit-js/

	// Enter the main event loop. This will block until the app is ready to exit.
	app_event_loop();

	// do clean up here
	deinit();
}

